import { Model } from "mongoose";
import { index, InstanceType, ModelType, prop, staticMethod, Typegoose } from "typegoose";
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
        return field;
    }

    @staticMethod
    public static getModelForTeam(teamId: string): Model<InstanceType<SnackRequest>> {
        return new SnackRequest().getModelForClass(SnackRequest, {
            schemaOptions: { timestamps: true, collection: `snack-requests-${teamId}` },
        });
    }
    @prop({ required: true })
    public snack!: Snack;

    @prop({ required: true })
    public requesters!: SnackRequester[];

    @prop({ required: true })
    public location!: SnackRequestLocation;

    @prop({ required: true })
    public originalRequestString!: string;

    public getInitialRequester(): SnackRequester {
        return this.requesters[0];
    }
}
