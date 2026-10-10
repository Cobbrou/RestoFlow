import { SetMetadata } from "@nestjs/common";

export const IS_PUBLIC_KEY = "isPublic";

/**
 * Marque un handler HTTP ou WebSocket comme accessible sans session (ex : saisie du PIN)
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
