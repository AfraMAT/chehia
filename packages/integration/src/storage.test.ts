import { describe, expect, it } from "vitest";
import { anonClient, staffClient, EL_MARSA_ID, LE_ZINK_ID } from "./helpers";

// 1×1 transparent PNG.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

describe("Storage — item-photos bucket RLS", () => {
  it("staff can upload into their own restaurant folder and read it via the public URL", async () => {
    const owner = await staffClient("owner@elmarsa.tn");
    const path = `${EL_MARSA_ID}/test-${Date.now()}.png`;
    const { error } = await owner.storage.from("item-photos").upload(path, PNG, { contentType: "image/png" });
    expect(error).toBeNull();

    const { data } = owner.storage.from("item-photos").getPublicUrl(path);
    const res = await fetch(data.publicUrl);
    expect(res.status).toBe(200);

    await owner.storage.from("item-photos").remove([path]);
  });

  it("staff cannot upload into another tenant's folder (tenant-scoped RLS)", async () => {
    const owner = await staffClient("owner@elmarsa.tn");
    const { error } = await owner.storage
      .from("item-photos")
      .upload(`${LE_ZINK_ID}/evil-${Date.now()}.png`, PNG, { contentType: "image/png" });
    expect(error).not.toBeNull();
  });

  it("anonymous users cannot upload photos", async () => {
    const anon = anonClient();
    const { error } = await anon.storage
      .from("item-photos")
      .upload(`${EL_MARSA_ID}/anon-${Date.now()}.png`, PNG, { contentType: "image/png" });
    expect(error).not.toBeNull();
  });
});
