const snowflake = /^\d{15,22}$/;
export function roleMention(roleId: string) {
  if (!snowflake.test(roleId)) throw Error("Rôle de notification invalide.");
  return {content:`<@&${roleId}>`,allowed_mentions:{parse:[] as string[],users:[] as string[],roles:[roleId],replied_user:false}};
}
