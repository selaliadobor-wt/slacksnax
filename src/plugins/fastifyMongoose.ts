import fastify from "fastify";
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
interface DetailedOptions {
    uri: string;
    options: Mongoose.ConnectionOptions;
}

type Options = DetailedOptions | String;

// declare plugin type using fastify.Plugin
const fastifyMongoose: fastify.Plugin<Server, IncomingMessage, ServerResponse, Options> = async function(
    instance,
    options,
    next
) {
    const uri = typeof options === "string" ? options : (options as DetailedOptions).uri;
    const mongoOptions = typeof options === "string" ? {} : (options as DetailedOptions).options;

    try {
        await Mongoose.connect(uri, mongoOptions);
        instance.decorate("Mongoose", Mongoose).addHook("onClose", function(fastify, done) {
            instance.Mongoose.connection.close(done);
        });

        instance.decorate("db", Mongoose.connection);

        next();
    } catch (err) {
        next(err);
    }
};

export = fastifyMongoose;
