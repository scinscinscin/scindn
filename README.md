### ScinDN

A self hostable uploadthing clone

### To run (without docker)
1. Clone this repository
2. Install the packages with `yarn`
3. Run `yarn migrate` to initialize the database
4. Copy `.env.example` to `.env` and fill any necessary fields
5. Run `yarn dev`, or `yarn windev` if you're getting `ts-node` errors

### To run (with Docker)
1. Clone this repository
2. Build the docker image using `docker build -t scindn .`
3. Run with `docker-compose up`
   1. Make sure to edit the compose file and set the environment variables and volume paths