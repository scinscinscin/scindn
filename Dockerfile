FROM node:20

WORKDIR /app
COPY . .
RUN yarn && yarn build && npx prisma generate
CMD ["yarn", "start"]
EXPOSE 8000