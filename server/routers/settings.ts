import * as db from "../db";
import { storagePut } from "../storage";
import { adminProcedure, publicProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

const maxLogoBytes = 1_000_000;

function parseImageDataUri(dataUri: string) {
  const match = dataUri.match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!match) throw new TRPCError({ code: "BAD_REQUEST", message: "Envie uma imagem PNG, JPEG ou WebP válida." });
  const buffer = Buffer.from(match[2], "base64");
  if (!buffer.length || buffer.length > maxLogoBytes) {
    throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "A imagem deve ter no máximo 1 MB." });
  }
  return { buffer, contentType: match[1] };
}

export const settingsRouter = router({
  get: publicProcedure.query(() => db.getAppSettings()),
  updateBrand: adminProcedure
    .input(z.object({ brandName: z.string().trim().min(2).max(80), logoDataUri: z.string().max(1_500_000).nullable().optional() }))
    .mutation(async ({ ctx, input }) => {
      const previous = await db.getAppSettings();
      let logoUrl: string | null | undefined;
      let logoStorageKey: string | null | undefined;
      if (input.logoDataUri) {
        const image = parseImageDataUri(input.logoDataUri);
        const extension = image.contentType === "image/png" ? "png" : image.contentType === "image/webp" ? "webp" : "jpg";
        const uploaded = await storagePut(`branding/logo.${extension}`, image.buffer, image.contentType);
        logoUrl = uploaded.url;
        logoStorageKey = uploaded.key;
      }
      const updated = await db.updateAppSettings({
        brandName: input.brandName,
        ...(logoUrl !== undefined ? { logoUrl, logoStorageKey } : {}),
        updatedByOpenId: ctx.user.openId,
      });
      await db.createAdminAuditLog({
        actorOpenId: ctx.user.openId,
        action: "brand.updated",
        targetType: "appSettings",
        targetId: "1",
        previousValue: JSON.stringify({ brandName: previous.brandName, logoUrl: previous.logoUrl }),
        nextValue: JSON.stringify({ brandName: updated.brandName, logoUrl: updated.logoUrl }),
      });
      return updated;
    }),
});
