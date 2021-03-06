import { Model } from "mongoose";
import { index, InstanceType, ModelType, prop, staticMethod, Typegoose } from "typegoose";
import { SnackRequestLocation } from "./snackRequestLocation";

export class UserLocation extends Typegoose {
    public static create(args: { userId: string; location: SnackRequestLocation }): UserLocation {
        const field = new UserLocation();

        field.userId = args.userId;
        field.locationId = args.location.id;
        return field;
    }

    @staticMethod
    public static getModelForTeam(teamId: string): Model<InstanceType<UserLocation>> {
        return new UserLocation().getModelForClass(UserLocation, {
            schemaOptions: { timestamps: true, collection: `user-locations-${teamId}` },
        });
    }

    @prop({ required: true })
    public locationId!: string;
    @prop({ required: true })
    public userId!: string;
}
