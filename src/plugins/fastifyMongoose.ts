import fastify, { RegisterOptions } from "fastify";
import { IncomingMessage, Server, ServerResponse } from "http";

import Mongoose from "mongoose";

if (!Mongoose) {
    throw new Error("Could not find Mongoose, was it installed?");
}

declare module "fastify" {
    interface FastifyInstance {
        Mongoose: Mongoose.Mongoose;
        db: Mongoose.Connection;
    }
}
interface DetailedOptions extends RegisterOptions<Server, IncomingMessage, ServerResponse> {
    uri: string;
    mongoOptions?: Mongoose.ConnectionOptions;
}

// declare plugin type using fastify.Plugin
const fastifyMongoose: fastify.Plugin<Server, IncomingMessage, ServerResponse, DetailedOptions> = async (
    instance,
    options,
    next
) => {
    try {
        await Mongoose.connect(options.uri, options.mongoOptions);
        instance.decorate("Mongoose", Mongoose).addHook("onClose", async (_, done) => {
            await instance.Mongoose.connection.close(done);
        });

        instance.decorate("db", Mongoose.connection);

        next();
    } catch (err) {
        next(err);
    }
};

export default fastifyMongoose;
