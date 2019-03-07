import * as fastify from "fastify";

require("dotenv").config();

const port = Number(process.env.PORT) || 1234;

const server: fastify.FastifyInstance = fastify.default({
    logger: "trace",
});

server.get("/", async () => {
    return "Hello World!";
});

const start = async () => {
    try {
        await server.listen(port, "0.0.0.0");

        server.log.info(server.printRoutes());

        let address = server.server.address();

        if (address === undefined) {
            throw new Error("Failed to bind to address");
        } else {
            server.log.info(`Listening on ${address!.port}`);
        }
    } catch (err) {
        server.log.error(err);
        process.exit(1);
    }
};

start();
