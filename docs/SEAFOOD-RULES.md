# Dữ liệu và quy tắc thủy sản — phiên bản minh họa

## Phạm vi

Đây là **mô phỏng quy trình thu thập chứng cứ và điều phối của forwarder**, không phải chứng nhận an toàn thực phẩm, xác nhận nhà máy được cấp phép, hay danh mục pháp luật cập nhật của từng quốc gia. Tất cả tên công ty, mã nhà máy, phiếu kiểm nghiệm, chứng thư, sensor và nhiệt độ đo là **dữ liệu tự tạo**. Mọi ngưỡng `customerSpec` là điều kiện **booking/hợp đồng giả lập**. Nhân viên phải kiểm tra yêu cầu của nhà nhập khẩu và cơ quan có thẩm quyền trước khi vận hành thật.

## Cách tạo 500 lô đa dạng hơn

- 250 lô tôm và 250 lô cá tra, bốn thị trường JP/KR/EU/US, ba kiểu đóng gói, nhiều cỡ và dạng sản phẩm, bốn nhà máy giả lập; mã lô sản xuất được chia theo nhóm sản xuất, mã đơn/booking vẫn duy nhất.
- 17 nhánh tình huống gốc: sẵn sàng, SI chờ xác nhận, thiếu VGM, chứng thư chờ xem, seal lệch, reefer chưa xác nhận điện, đã vào bãi, sai mạ băng/phiếu sulfite, thiếu/lệch mã lô, phiếu dư lượng chờ hoặc không đạt, nhiệt độ hàng vượt ngưỡng, chỉ có khí hồi chứ thiếu đầu dò hàng, thiếu tham chiếu nhà máy EU. Những lỗi SI cũ, đầu dò hàng nóng cũng có thể chồng lên các nhánh này.
- Mỗi lô có số kiểm tra phụ thuộc thị trường và loại hàng; 1–2 container, mỗi container tối đa 6 cặp bản ghi nhiệt độ khí hồi và nhiệt độ đầu dò hàng. Nhiều lô chia sẻ nhà máy và lô sản xuất, tương tự quan hệ thực tế nhưng đều là mã giả lập.
- Trạng thái xuất từ các kết quả kiểm tra: `MISMATCH` → `BLOCKED`; thiếu mã lô, phiếu dư lượng hoặc đầu dò hàng → `BLOCKED`; các loại thiếu/chờ khác → `AT_RISK`; đủ → `READY`; riêng `COMPLETED` chỉ biểu thị sự kiện vào bãi mô phỏng và chỉ khi không có lỗi.

Sau khi sinh mẫu, thống kê là **70 READY, 146 AT_RISK, 197 BLOCKED và 87 COMPLETED**. Tỷ lệ lỗi được cố ý tăng để có nhiều ca thử giao diện và xử lý; **không phải tỷ lệ sự cố của ngành**.

Các lỗi SI, seal, chứng thư, mã lô trên packing list và hồ sơ nhà máy được giao **Bộ phận Chứng từ**; VGM và xác nhận điện container giao **Bộ phận Vận tải / Hiện trường**; kiểm nghiệm, quy cách và nhiệt độ đầu dò hàng giao **Bộ phận Kiểm soát chất lượng**. Chưa tạo việc cho Thu mua vì các sự cố mẫu chưa yêu cầu mua hàng. Bộ dữ liệu tạo 275 việc chưa làm, 100 việc đang xử lý và 143 việc đã hoàn tất; việc đã hoàn tất chỉ gắn với SI kiểm tra PASS và chứng từ SI VERIFIED. Cách phân công này là quy trình tham khảo cho đơn vị điều phối; khi áp dụng thật cần xác định doanh nghiệp nào sở hữu từng công việc.

Các URL dễ dùng khi thuyết trình: `/shipments/SHP-0015` cho đầu dò hàng vượt giới hạn; `/shipments/SHP-0016` cho container chỉ có khí hồi; `/shipments/SHP-0017` cho hồ sơ nhà máy EU còn thiếu; `/shipments/SHP-0266` cho cá tra mạ băng vượt điều kiện mẫu; `/shipments/SHP-0011` cho tôm có phiếu sulfite chờ đối chiếu. Luôn đọc các kiểm tra trong từng lô vì một lô có thể có **nhiều vấn đề cùng lúc**.

## Bảng quy tắc (đọc tại `scripts/seafood-rules.mjs`)

| Kiểm tra | Dữ liệu vào | Điều kiện mẫu | Nếu sai hoặc thiếu |
| --- | --- | --- | --- |
| `LOT_TRACE` | `lotCode`, `packingListLotCode` | Có mã lô và khớp packing list | Chặn lô, truy xuất lại với nhà máy. |
| `FACTORY_EVIDENCE` | Thị trường, yêu cầu hồ sơ nhà máy, `factoryApprovalRef` | Nếu đơn EU cần tham chiếu hồ sơ nhà máy do khách hàng cung cấp; nhân viên kiểm tra bằng nguồn có thẩm quyền | Báo thiếu và yêu cầu xác minh, không tự kết luận nhà máy được duyệt. |
| `PRODUCT_SPEC` | Dạng, cỡ, đóng gói, `glazePercent` | Cá tra có mức mạ băng không vượt **ngưỡng hợp đồng mẫu 20%** | Sai quy cách → chặn. Mức 20% không đại diện cho luật chung. |
| `LAB_RESIDUE` | Kết quả kiểm nghiệm, mã lô mẫu | Phiếu khớp mã lô và kết quả đạt theo hợp đồng | Thiếu/không đạt → chặn; chờ kiểm tra → cảnh báo. Không suy ra một phiếu PASS là đủ thay cho kiểm soát an toàn. |
| `LAB_SULFITE` | Phiếu sulfite tôm | Chỉ áp dụng nếu danh mục kiểm tra theo buyer có `SULFITE`; ví dụ lô tôm đi US | Thiếu/chờ/không đạt → cảnh báo hoặc chặn. Không áp dụng cho cá tra. |
| `LAB_MICROBIOLOGY` | Phiếu vi sinh | Chỉ áp dụng nếu buyer yêu cầu trong dữ liệu mẫu (ví dụ một số lô JP) | Thiếu/chờ/không đạt → cảnh báo hoặc chặn. Không gán thành luật Nhật Bản. |
| `CARGO_TEMP` | Từng container, khí hồi và đầu dò hàng có dấu giờ | Mỗi container cần số đo `CARGO_PROBE` không cũ hơn **6 giờ** và mọi số đo đầu dò không vượt **−17°C** trong mẫu | Thiếu đầu dò → chặn vì chưa chứng minh nhiệt độ hàng; đầu dò vượt ngưỡng → chặn và kiểm tra thực tế. Khí hồi và setpoint không chứng minh nhiệt độ hàng. |

Ngoài các kiểm tra trên, hệ thống giữ quy tắc SI/VGM/CY, seal, nhiệt độ cài đặt/nguồn điện và chứng thư theo cấu hình từng lô. `latestStartAt` hiện trừ thời gian thao tác và khoảng dự phòng riêng theo loại việc (xem `docs/DEMO-SAI-SEAL.md`); đây vẫn là giả định để trình diễn, chưa phải dự báo từ dữ liệu vận hành.

**Tính chất của số đo:** `CARGO_PROBE` là dữ liệu đầu dò hàng giả lập. Thiết bị thực tế có thể không cung cấp đầu dò hàng; khi đó chương trình báo **thiếu chứng cứ**, không kết luận hàng đã hỏng. Dữ liệu có điểm đo theo giờ, chưa là hồ sơ hiệu chuẩn hay chuỗi thời gian liên tục, không xác nhận toàn bộ container đạt nhiệt độ đồng đều.

## Nguồn cho việc chọn loại vấn đề

- [IMO — Verification of the gross mass](https://www.imo.org/en/OurWork/Safety/Pages/Verification-of-the-gross-mass.aspx): trách nhiệm VGM và điều kiện xếp tàu.
- [Ủy ban châu Âu — điều kiện nhập khẩu thủy sản](https://trade.ec.europa.eu/access-to-markets/en/content/health-and-consumer-protection-animal-and-plant-product): tham chiếu chứng thư, cơ sở và kiểm soát đối với thủy sản vào EU; bản demo không kiểm tra danh sách hiện hành.
- [FDA — Seafood HACCP questions and answers](https://www.fda.gov/regulatory-information/search-fda-guidance-documents/guidance-industry-questions-and-answers-haccp-regulation-fish-and-fishery-products): phân tích mối nguy tôm nuôi và sulfite theo hoàn cảnh; không có một phép thử duy nhất áp dụng cho mọi lô.
- [Maersk — thiết bị lạnh](https://www.maersk.com/logistics-explained/transportation-and-freight/2025/03/06/reefer-containers): setpoint, khí và giám sát container lạnh.

## Giới hạn triển khai

Quy tắc chạy khi **sinh dữ liệu mẫu**, kết quả được lưu trong API/Supabase qua script nạp. Chưa có API cập nhật booking, kết quả kiểm nghiệm, số đo sensor và tự tính lại sau khi thay đổi; giao diện cập nhật công việc/chứng từ hiện chỉ mô phỏng trong trình duyệt. `review` không có PDF hoặc mô hình AI thật. Khi có nghiệp vụ thật, cần xác minh mẫu đối chứng, quy định thay đổi theo thị trường/mặt hàng/khách hàng, phân quyền và log kiểm toán trước khi xử lý hàng thật.

Nếu Supabase đã có bộ 500 lô giả lập **cũ**, script nạp sẽ dừng để tránh giữ sót chứng từ/check/task cũ. Sau khi sao lưu hoặc xác nhận không cần các thao tác đã nhập ở tổ chức giả lập, đặt `SEED_REPLACE_EXISTING_SYNTHETIC=true` trong `.env.local`, chạy nạp lại rồi xóa biến đó. Thao tác này chỉ cho phép với tổ chức có tên `NexusCargo Synthetic Workspace` và xóa các bản ghi phụ của 500 mã lô mẫu để nạp bản mới. Không dùng biến này cho dữ liệu thật.
