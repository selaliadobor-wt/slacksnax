import { prop, Typegoose, ModelType, InstanceType, staticMethod, index } from "typegoose";
import { SnackRequester } from "./snackRequester";
import { SnackRequestLocation } from "./snackRequestLocation";
import { Snack } from "../snackSearch/snack";

@index({ originalRequestString: "text", "snack.friendlyName": "text" }, <any>{
    weights: {
        originalRequestString: 5,
        "snack.friendlyName": 10,
    },
})
export class SnackRequest extends Typegoose {
    @prop({ required: true })
    snack!: Snack;

    @prop({ required: true })
    requesters!: SnackRequester[];

    @prop({ required: true })
    location!: SnackRequestLocation;

    @prop({ required: true })
    originalRequestString!: string;

    getInitialRequester() {
        return this.requesters[0];
    }

    public static create(args: {
        snack: Snack;
        initialRequester: SnackRequester;
        location: SnackRequestLocation;
        originalRequestString: string;
    }) {
        let field = new SnackRequest();
        field.originalRequestString = args.originalRequestString;
        field.snack = args.snack;
        field.requesters = [args.initialRequester];
        field.location = args.location;
        return field;
    }

    @staticMethod
    static getModelForTeam(teamId: string) {
        return new SnackRequest().getModelForClass(SnackRequest, {
            schemaOptions: { timestamps: true, collection: `snack-requests-${teamId}` },
        });
    }
}
