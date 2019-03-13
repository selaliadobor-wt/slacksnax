import Redis from "ioredis";
var redis = new Redis(process.env.REDIS_URL);

import fastify from "fastify";
import { Server, IncomingMessage, ServerResponse } from "http";

declare module "fastify" {
    interface FastifyInstance {
        redis: Redis.Redis;
    }
}

// declare plugin type using fastify.Plugin
const fastifyRedisPlugin: fastify.Plugin<
    Server,
    IncomingMessage,
    ServerResponse,
    never
> = async function(instance, options, next) {
    try {
        instance.decorate("redis", require("./redis")).addHook("onClose", function(fastify, done) {
            fastify.redis.quit(done);
        });
        next();
    } catch (err) {
        next(err);
    }
};

export { redis, fastifyRedisPlugin };
