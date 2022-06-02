FROM mcr.microsoft.com/playwright:focal as dev

RUN node --version

WORKDIR /usr/app

# Install node dependencies - done in a separate step so Docker can cache it.
COPY package-lock.json .
COPY package.json .

RUN npm i --ignore-scripts

COPY . .

RUN npm run build

CMD ["npm", "run", "test:browser"]