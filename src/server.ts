import fastify from "fastify";
import mongoose from "mongoose";
import fastifyMongoose from "./plugins/fastifyMongoose";
import { fastifyRedisPlugin } from "./redis";
import { ActionManagerInstance } from "./slack/actions/actionManager";
import { SlashCommandManagerInstance } from "./slack/slashCommandManager";

import dotenv = require("dotenv");
dotenv.config();

const monogoUri = process.env.MONGODB_URI;
if (monogoUri === undefined) {
    throw new Error("MONGODB_URI not set");
}
(mongoose as any).Promise = global.Promise;

const port = Number(process.env.PORT) || 1234;

const server = fastify({
    logger: {
        level: "trace",
    },
});

const start = async () => {
    SlashCommandManagerInstance.setFastifyInstance(server);

    (await import("./snackSearch/snackSearchSlashCommands")).registerSlashCommands();
    (await import("./requests/requestLocationSlashCommands")).registerSlashCommands();
    server.register(require("fastify-formbody"));
    server.register(fastifyMongoose, {
        uri: monogoUri,
    });
    server.register(fastifyRedisPlugin);

    server.register(ActionManagerInstance.routes());
    server.register(require("./slack/authRoute"));

    server.get("/", async () => {
        return "Hello World!";
    });

    try {
        await server.listen(port, "0.0.0.0");

        server.log.info(server.printRoutes());

        const address = server.server.address();

        server.log.info(`Listening on ${JSON.stringify(address)}`);
    } catch (err) {
        server.log.error(err);
        process.exit(1);
    }
};

void start();

const logger = server.log;
export { logger };
