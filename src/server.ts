import fastify from "fastify";
import mongoose from "mongoose";
import fastifyMongoose from "./plugins/fastifyMongoose";
import { fastifyRedisPlugin } from "./redis";
import { ActionManagerInstance } from "./slack/actions/actionManager";
import { SlashCommandManagerInstance } from "./slack/slashCommandManager";
require("dotenv").config();

const monogoUri = process.env.MONGODB_URI;
if (monogoUri == null) {
    throw new Error("MONGODB_URI not set");
}
(<any>mongoose).Promise = global.Promise;

const port = Number(process.env.PORT) || 1234;

const server = fastify({
    logger: {
        level: "trace",
    },
});

SlashCommandManagerInstance.setFastifyInstance(server);

require("./snackSearch/snackSearchRoute");
require("./requests/userLocationRoute");

server.register(require("fastify-formbody"));
server.register(fastifyMongoose, monogoUri);
server.register(fastifyRedisPlugin);

server.register(ActionManagerInstance.route());
server.register(require("./slack/authRoute"));

server.get("/", async () => {
    return "Hello World!";
});

const start = async () => {
    try {
        await server.listen(port, "0.0.0.0");

        server.log.info(server.printRoutes());

        let address = server.server.address();

        server.log.info(`Listening on ${JSON.stringify(address)}`);
    } catch (err) {
        server.log.error(err);
        process.exit(1);
    }
};

start();

const logger = server.log;
export { logger };
