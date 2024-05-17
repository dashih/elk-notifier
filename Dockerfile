FROM node:20.13.1
WORKDIR /home/node/app
COPY . .
CMD [ "node", "app.js" ]
