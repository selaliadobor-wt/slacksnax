import { WebAPICallResult, WebClient } from "@slack/client";
import * as fastify from "fastify";
import { IncomingMessage, Server, ServerResponse } from "http";
import Redis from "ioredis";
import { Definitions } from "typed-slack-client";
import { v4 as uuid } from "uuid";
import { redis } from "../../redis";
import { logger } from "../../server";
type ActionCallback = (
    payload: Definitions.InteractiveActions.Payload,
    reply: fastify.FastifyReply<ServerResponse>
) => Promise<void>;
type ContextIdActionCallback = (
    payload: Definitions.InteractiveActions.Payload,
    reply: fastify.FastifyReply<ServerResponse>,
    action: Definitions.InteractiveActions.PayloadAction,
    context: string
) => Promise<void>;

class ActionManager {
    public callbacks: ActionCallback[] = [];
    public contextCacheTtl = 60 * 5;

    public async setInteractionContext<T>(interactionType: string, context: T): Promise<string> {
        if (context === undefined) {
            (context as any) = null; // JSON can not represent undefined
        }
        const contextId = `${interactionType}:${uuid()}`;
        const redisKey = this.getRedisKeyForContext(contextId);
        await redis.set(redisKey, JSON.stringify(context), "ex", this.contextCacheTtl);
        return contextId;
    }

    public async getInteractionContext<T>(contextId: string): Promise<T | null> {
        const context = await redis.get(this.getRedisKeyForContext(contextId));
        if (context === null) {
            return null;
        }
        return JSON.parse(context);
    }

    public listenForSlackInteractions(callback: ActionCallback): void {
        this.callbacks.push(callback);
    }

    public listenForCallbackIdOfType(actionType: string, callback: ActionCallback): void {
        this.callbacks.push(async (payload, reply) => {
            if (payload.callback_id === undefined) {
                return;
            }

            if (payload.callback_id.startsWith(actionType)) {
                await callback(payload, reply);
            }
        });
    }

    public listenForBlockIdOfType(actionType: string, callback: ContextIdActionCallback): void {
        this.callbacks.push(async (payload, reply) => {
            if (payload.actions === undefined) {
                return;
            }

            await Promise.all(
                payload.actions.map(async action => {
                    if (action.block_id.startsWith(actionType)) {
                        await callback(payload, reply, action, action.block_id);
                    }
                })
            );
        });
    }

    public listenForActionIdOfType(actionType: string, callback: ContextIdActionCallback): void {
        this.callbacks.push(async (payload, reply) => {
            if (payload.actions === undefined) {
                return;
            }

            await Promise.all(
                payload.actions.map(async action => {
                    if (action.action_id.startsWith(actionType)) {
                        await callback(payload, reply, action, action.action_id);
                    }
                })
            );
        });
    }

    public routes(): fastify.Plugin<Server, IncomingMessage, ServerResponse, never> {
        return async (instance: fastify.FastifyInstance) =>
            instance.post<fastify.DefaultQuery, fastify.DefaultParams, fastify.DefaultHeaders, { payload: string }>(
                "/slackInteractiveActions",
                async (request, reply) => {
                    for (const callback of this.callbacks) {
                        try {
                            await callback(
                                JSON.parse(request.body.payload) as Definitions.InteractiveActions.Payload,
                                reply
                            );

                            if (reply.sent) {
                                logger.info("Handled callback for action", reply, request.body);
                                break;
                            }
                        } catch (err) {
                            logger.error("Failed to process callback for action", err, request.body);
                        }
                    }
                    if (!reply.sent) {
                        logger.error("Failed to find working callback for interaction", request.body);
                        reply.code(500).send("Sorry an internal error occured.");
                    }
                }
            );
    }
    private getRedisKeyForContext = (contextId: string) => `slack-interaction-context:${contextId}`;
}

const ActionManagerInstance = new ActionManager();
export { ActionManagerInstance };
