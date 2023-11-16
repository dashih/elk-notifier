FROM node:20.9.0
WORKDIR /home/node/app
COPY . .
CMD [ "node", "app.js" ]
