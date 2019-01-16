FROM ubuntu:bionic-20181204

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

# install common/useful packages
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
		curl \
		file \
		gettext-base \
		git-core \
		iproute2 \
		iputils-ping \
		jq \
		less \
		libjpeg-dev \
		libogg-dev \
		libpng-dev \
		libtool \
		locales \
		netcat-openbsd \
		net-tools \
		openssl \
		pkg-config \
		procps \
		psmisc \
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

# install daalatool
ENV \
	DAALATOOL_DIR=/opt/daalatool

RUN \
	mkdir -p $(dirname ${DAALATOOL_DIR}) && \
	git clone https://github.com/xiph/daala.git ${DAALATOOL_DIR} && \
	cd ${DAALATOOL_DIR} && \
	./autogen.sh && \
	./configure --disable-player && \
	make tools -j4

# install rd_tool dependencies
RUN \
	apt-get update && \
	apt-get install -y --no-install-recommends \
		bc \
		python3-numpy \
		python3-scipy \
		ssh \
		time \
		&& \
	apt-get clean && \
	rm -rf /var/lib/apt/lists && \
	rm -vf /etc/ssh/ssh_host_*

# set working directory
WORKDIR /home/${APP_USER}

# environment variables
ENV \
	WORK_DIR=/data/work

# set entrypoint
ADD etc/entrypoint.worker /etc/entrypoint.worker
ENTRYPOINT [ "/etc/entrypoint.worker" ]
