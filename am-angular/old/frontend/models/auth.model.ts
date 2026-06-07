export interface IUser {
    email?: string;
    name?: string;
    image?: string;
}

export interface IAuthResponse {
    user?: IUser;
    session?: any;
}