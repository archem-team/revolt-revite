// Type extensions for message flags support
// This file extends the revolt-api types to include the missing flags field

declare module "revolt-api" {
    interface DataMessageSend {
        /**
         * Bitfield of message flags
         * 
         * https://docs.rs/revolt-models/latest/revolt_models/v0/enum.MessageFlags.html
         */
        flags?: number;
    }
}