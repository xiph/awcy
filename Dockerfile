FROM ubuntu:bionic-20181112

# environment variables
ENV \
	APP_USER=xiph \
	APP_DIR=/opt/app \
	LC_ALL=C.UTF-8 \
	LANG=C.UTF-8 \
	LANGUAGE=C.UTF-8 \
	DEBIAN_FRONTEND=noninteractive

# add runtime user
RUN \
	groupadd --gid 1000 ${APP_USER} && \
	useradd --uid 1000 --gid ${APP_USER} --shell /bin/bash --create-home ${APP_USER}

# install base build dependencies and useful packages
RUN \
	echo "deb http://archive.ubuntu.com/ubuntu/ bionic main restricted universe multiverse"           >/etc/apt/sources.list && \
	echo "deb http://security.ubuntu.com/ubuntu bionic-security main restricted universe multiverse" >>/etc/apt/sources.list && \
	echo "deb http://archive.ubuntu.com/ubuntu/ bionic-updates main restricted universe multiverse"  >>/etc/apt/sources.list && \
	apt-get update && \
	apt-get install -y --no-install-recommends \
		autoconf \
		automake \
		build-essential \
		bzip2 \
		ca-certificates \
		check \
		cmake \
		cmake-extras \
		curl \
		dirmngr \
		file \
		gettext-base \
		git-core \
		gpg \
		gpg-agent \
		iproute2 \
		iputils-ping \
		jq \
		less \
		libicu-dev \
		libjpeg-dev \
		libogg-dev \
		libpng-dev \
		libtool \
		locales \
		nasm \
		netcat-openbsd \
		net-tools \
		openssl \
		pkg-config \
		procps \
		psmisc \
		python2.7 \
		rsync \
		strace \
		tcpdump \
		tzdata \
		unzip \
		uuid \
		vim \
		wget \
		xz-utils && \
	apt-get clean && \
	rm -rf /var/lib/apt/lists

# set working directory
WORKDIR ${APP_DIR}

# prepare rust installation
ENV \
	RUSTUP_HOME=/usr/local/rustup \
	CARGO_HOME=/usr/local/cargo \
	PATH=/usr/local/cargo/bin:${PATH}

# install rust
RUN \
	RUST_VERSION=1.30.1 && \
	curl -sSf --output /tmp/rustup-init https://static.rust-lang.org/rustup/archive/1.14.0/x86_64-unknown-linux-gnu/rustup-init && \
	chmod +x /tmp/rustup-init && \
	/tmp/rustup-init -y --no-modify-path --default-toolchain ${RUST_VERSION} && \
	rm -vf /tmp/rustup-init && \
	chmod -R a+w ${RUSTUP_HOME} ${CARGO_HOME}

# install node 8.x
RUN \
	NODE_VERSION=8.12.0 && \
	ARCH=x64 && \
	for key in \
		94AE36675C464D64BAFA68DD7434390BDBE9B9C5 \
		FD3A5288F042B6850C66B31F09FE44734EB7990E \
		71DCFD284A79C3B38668286BC97EC7A07EDE3FC1 \
		DD8F2338BAE7501E3DD5AC78C273792F7D83545D \
		C4F0DFFF4E8C1A8236409D08E73BC641CC11F4C8 \
		B9AE9905FFD7803F25714661B63B535A4C206CA9 \
		56730D5401028683275BD23C23EFEFE93C4CFFFE \
		77984A986EBC2AA786BC0F66B01FBB92821C587A \
		8FCCA13FEF1D0C2E91008E09770F7A9A5AE15600 \
	; do \
		http_proxy= gpg --keyserver hkp://ipv4.pool.sks-keyservers.net:80 --recv-keys "${key}"; \
	done && \
	curl -fSLO "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-${ARCH}.tar.xz" && \
	curl -fSLO "https://nodejs.org/dist/v${NODE_VERSION}/SHASUMS256.txt.asc" && \
	gpg --batch --decrypt --output SHASUMS256.txt SHASUMS256.txt.asc && \
	grep " node-v${NODE_VERSION}-linux-${ARCH}.tar.xz\$" SHASUMS256.txt | sha256sum -c - && \
	tar xJf "node-v${NODE_VERSION}-linux-${ARCH}.tar.xz" -C /usr --strip-components=1 --no-same-owner && \
	rm -vf "node-v${NODE_VERSION}-linux-${ARCH}.tar.xz" SHASUMS256.txt.asc SHASUMS256.txt && \
	ln -s /usr/bin/node /usr/bin/nodejs

# add code
ADD package.json *.ts tsconfig.json ${APP_DIR}/
ADD www ${APP_DIR}/www

# compile typescript/nodejs code
RUN \
	cd ${APP_DIR} && \
	export PYTHON=python2.7 && \
	npm install && \
	npm run tsc && \
	cd ${APP_DIR}/www && \
	npm install && \
	npm run build

# add scripts
ADD *.m *.sh *.py ${APP_DIR}/

# add sets
ADD sets.json ${APP_DIR}/rd_tool/

# configure workdir
RUN \
	mkdir runs && \
	touch ${APP_DIR}/subjective.sqlite3 && \
	chown ${APP_USER}:${APP_USER} ${APP_DIR}/subjective.sqlite3 runs && \
	echo '[]' >list.json && \
	chown ${APP_USER}:${APP_USER} ${APP_DIR} ${APP_DIR}/list.json

# configure application
RUN \
	echo '{ "channel": "#daalatest", "have_aws": false, "port": 3000, "rd_server_url": "http://xiph-scheduler:4000" }' >config.json && \
	echo 'awcy_api_key' >secret_key

# start application
CMD [ "sh", "-c", "node awcy_server.js"]
