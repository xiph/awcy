FROM node:boron

# Create app directory
RUN mkdir -p /usr/src/awcy
WORKDIR /usr/src/awcy

# Install app dependencies
COPY package.json /usr/src/awcy/
RUN npm install

# Bundle app source
COPY . /usr/src/awcy

EXPOSE 3000
CMD [ "npm", "start" ]
