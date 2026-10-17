CREATE UNIQUE INDEX "chat_messages_line_message_id_uid_idx" ON "public"."chat_messages" USING btree ("line_message_id") WHERE "line_message_id" is not null;
