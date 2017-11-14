FROM node:8
EXPOSE 80
ENV PORT 80
ENV APP_NAME=simple-platform-server
ENV STATIC_DIR=/home/node/app/www
COPY node_modules /home/node/app/node_modules
COPY www $STATIC_DIR
COPY build /home/node/app/build
CMD node /home/node/app/build/cli.js -a $APP_NAME -d $STATIC_DIR
