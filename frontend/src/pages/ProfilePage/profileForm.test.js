const {
  buildPreviewPayload,
  decodeQrPayload,
  encodeQrPayload,
  maskName,
  validateProfile,
} = require("./index");

const validProfile = {
  name: "Ayşe Yılmaz",
  blood: "A Rh+",
  allergy: "Penisilin",
  meds: "Metformin",
  chronic: "Diyabet",
  disability_notes: "Tekerlekli sandalye",
  emergency_contact_name: "Mehmet Yılmaz",
  emergency_contact_phone: "05321234567",
  phone: "05327654321",
};

describe("profile form helpers", () => {
  it("validates successful and failed profile save states", () => {
    expect(validateProfile(validProfile)).toEqual({});

    expect(validateProfile({ ...validProfile, name: "" })).toMatchObject({
      name: expect.stringContaining("zorunludur"),
    });

    expect(validateProfile({ ...validProfile, phone: "123" })).toMatchObject({
      phone: expect.stringContaining("Telefon"),
    });
  });

  it("builds a masked QR payload and round-trips encode/decode", () => {
    const payload = buildPreviewPayload(validProfile);

    expect(payload.name).toBe("Ayşe Y.");
    expect(payload.blood).toBe("A Rh+");
    expect(maskName("Tekisim")).toBe("Tekisim");

    const encoded = encodeQrPayload(payload);
    expect(decodeQrPayload(encoded)).toEqual(payload);
  });
});
