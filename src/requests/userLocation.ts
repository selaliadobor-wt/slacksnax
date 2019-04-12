import { Typegoose, prop, staticMethod, ModelType } from "typegoose";
import { SnackRequestLocation } from "./snackRequestLocation";

export class UserLocation extends Typegoose {
    @prop({ required: true })
    locationId!: string;
    @prop({ required: true })
    userId!: string;

    static create(args: { userId: string; location: SnackRequestLocation }) {
        let field = new UserLocation();

        field.userId = args.userId;
        field.locationId = args.location.id;
        return field;
    }

    @staticMethod
    static getModelForTeam(teamId: string) {
        return new UserLocation().getModelForClass(UserLocation, {
            schemaOptions: { timestamps: true, collection: `user-locations-${teamId}` },
        });
    }
}
