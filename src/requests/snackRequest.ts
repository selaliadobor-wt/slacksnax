import { Model } from "mongoose";
import { index, instanceMethod, InstanceType, ModelType, prop, staticMethod, Typegoose } from "typegoose";
import { v1 as uuid } from "uuid";
import { Snack } from "../snackSearch/snack";
import { SnackRequester } from "./snackRequester";
import { SnackRequestLocation } from "./snackRequestLocation";

@index({ originalRequestString: "text", "snack.name": "text" }, {
    weights: {
        originalRequestString: 5,
        "snack.name": 10,
    },
} as any)
export class SnackRequest extends Typegoose {
    public static create(args: {
        snack: Snack;
        initialRequester: SnackRequester;
        location: SnackRequestLocation;
        originalRequestString: string;
    }): SnackRequest {
        const field = new SnackRequest();
        field.originalRequestString = args.originalRequestString;
        field.snack = args.snack;
        field.requesters = [args.initialRequester];
        field.location = args.location;
        field.id = uuid();
        return field;
    }

    @staticMethod
    public static getModelForTeam(teamId: string): Model<InstanceType<SnackRequest>> {
        return new SnackRequest().getModelForClass(SnackRequest, {
            schemaOptions: { timestamps: true, collection: `snack-requests-${teamId}` },
        });
    }

    @staticMethod
    public static getInitialRequester(snackRequest: SnackRequest): SnackRequester {
        return snackRequest.requesters[0];
    }

    @prop({ required: true })
    public snack!: Snack;

    @prop({ required: true })
    public requesters!: SnackRequester[];

    @prop({ required: true })
    public location!: SnackRequestLocation;

    @prop({ required: true })
    public originalRequestString!: string;

    @prop({ required: false })
    public isFavorite!: boolean;

    @prop({ required: false })
    public isBlocked!: boolean;

    @prop({ required: false, unique: true })
    public id!: string;
}
