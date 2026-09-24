/**
 * Teaching rules for a forwarder's evidence workflow. Market-specific tests,
 * limits and customer instructions are fixture inputs, not legal declarations.
 * A verified document means staff reviewed the metadata; this code does not
 * certify seafood safety or establish that a destination authority approved it.
 */
export function evaluateSeafoodChecks(profile, containers, time, requiredBy) {
  const result = [];
  const add = (code, title, status, message, relatedDocumentIds = []) =>
    result.push({ code, title, status, message, relatedDocumentIds, requiredBy,
      updatedAt: new Date(time).toISOString() });
  const policy = profile.customerSpec;
  const lot = profile.lotCode;
  add("LOT_TRACE", "Truy xuất mã lô sản xuất", !lot ? "MISSING" : lot !== profile.packingListLotCode ? "MISMATCH" : "PASS",
    !lot ? "Chưa có mã lô sản xuất." : lot !== profile.packingListLotCode
      ? `Mã lô trên packing list (${profile.packingListLotCode ?? "trống"}) không khớp lô sản xuất ${lot}.`
      : `Mã lô ${lot} khớp packing list.`);
  add("FACTORY_EVIDENCE", "Hồ sơ nhà máy theo thị trường", policy.requiresFactoryApprovalEvidence && !profile.factoryApprovalRef ? "MISSING" : "PASS",
    policy.requiresFactoryApprovalEvidence && !profile.factoryApprovalRef
      ? `Thiếu bằng chứng nhà máy đủ điều kiện cho lô đi ${profile.marketCode}; cần nhân viên xác minh với nguồn chính thức.`
      : `Đã ghi nhận nhà máy ${profile.factoryCode}${profile.factoryApprovalRef ? `, tham chiếu ${profile.factoryApprovalRef}` : ""}.`);
  add("PRODUCT_SPEC", "Quy cách theo đơn đặt hàng", profile.product === "PANGASIUS" && profile.glazePercent !== null && policy.maxGlazePercent !== null && profile.glazePercent > policy.maxGlazePercent ? "MISMATCH" : "PASS",
    profile.product === "PANGASIUS"
      ? `Tỷ lệ mạ băng mẫu ${profile.glazePercent}% / giới hạn hợp đồng ${policy.maxGlazePercent}%; ${profile.productForm}, ${profile.sizeGrade}.`
      : `Quy cách ${profile.productForm}, cỡ ${profile.sizeGrade}, ${profile.packaging}.`);
  for (const kind of policy.requiredTests) {
    const test = profile.labResults.find((row) => row.kind === kind && row.testedLotCode === lot);
    const label = { RESIDUE: "dư lượng", SULFITE: "sulfite", MICROBIOLOGY: "vi sinh" }[kind] ?? kind;
    add(`LAB_${kind}`, `Kiểm nghiệm ${label} theo hồ sơ lô`, !test ? "MISSING" : test.status === "FAIL" ? "MISMATCH" : test.status === "PENDING" ? "PENDING_REVIEW" : "PASS",
      !test ? `Thiếu phiếu ${label} khớp mã lô sản xuất.` :
        `Kết quả ${label}: ${test.status === "PASS" ? "đã xác nhận" : test.status === "PENDING" ? "chờ đối chiếu" : "không đạt điều kiện hợp đồng"}; mẫu lô ${test.testedLotCode}, phiếu ${test.reportNo}.`);
  }
  const allReadings = containers.flatMap((container) => container.temperatureReadings ?? []);
  const probes = allReadings.filter((reading) => reading.source === "CARGO_PROBE");
  const fresh = probes.filter((reading) => Date.parse(reading.observedAt) >= time - policy.maxProbeAgeHours * 3_600_000 && Date.parse(reading.observedAt) <= time);
  const missingContainer = containers.find((container) => !(container.temperatureReadings ?? []).some((reading) =>
    reading.source === "CARGO_PROBE" && Date.parse(reading.observedAt) >= time - policy.maxProbeAgeHours * 3_600_000 && Date.parse(reading.observedAt) <= time));
  const aboveLimit = probes.find((reading) => reading.celsius > policy.maxCargoTempCelsius);
  const status = aboveLimit ? "MISMATCH" : missingContainer ? "MISSING" : "PASS";
  add("CARGO_TEMP", "Nhiệt độ hàng đo bằng đầu dò", status,
    aboveLimit ? `Đầu dò hàng đo ${aboveLimit.celsius}°C, cao hơn giới hạn hợp đồng ${policy.maxCargoTempCelsius}°C; kiểm tra hàng và thiết bị.` :
      missingContainer ? `Container ${missingContainer.containerNo ?? missingContainer.id} không có số đo đầu dò hàng trong ${policy.maxProbeAgeHours} giờ gần nhất. Nhiệt độ cài đặt/khí hồi không chứng minh nhiệt độ hàng.` :
        `Có ${fresh.length} số đo đầu dò hàng còn hiệu lực; cao nhất ${Math.max(...fresh.map((reading) => reading.celsius))}°C, giới hạn hợp đồng ${policy.maxCargoTempCelsius}°C.`);
  return result;
}
