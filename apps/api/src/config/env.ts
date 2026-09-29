const required = (name: string): string => {
    const value = process.env[name];
    if (!value) {
        throw new Error(`Missing required environment variable: ${name}`);
    }
    return value;
};

export const env = {
    PORT: process.env.PORT || "5000",
    DATABASE_URL: required("DATABASE_URL"),
    JWT_SECRET: required("JWT_SECRET"),
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || "placeholder_google_client_id",
};
