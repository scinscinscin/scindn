FROM node:20
WORKDIR /src
COPY . .
RUN rm -rf .next/ && yarn && yarn build && npx prisma generate

FROM node:20
WORKDIR /app

COPY --from=0 /src/build /app/build
COPY --from=0 /src/.next /app/.next
COPY --from=0 /src/public /app/public
COPY --from=0 /src/node_modules /app/node_modules
COPY --from=0 /src/next.config.mjs /app/next.config.mjs
COPY --from=0 /src/package.json /app/package.json

CMD ["yarn", "start"]
EXPOSE 8000