import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import logoUrl from "@/assets/blx-logo.png";

export interface InvoiceData {
  bookingId?: string;
  leadId?: string;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  projectName?: string;
  unitNumber?: string;
  amount: number;
  paymentStatus?: string;
  bookingDate?: string;
}

/**
 * Generates and downloads a luxury, high-fidelity PDF Tax Invoice for BLX Realty.
 */
export async function downloadPdfInvoice(data: InvoiceData) {
  const invoiceNum = `INV-2026-${(data.bookingId || data.leadId || "001")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(-6)
    .toUpperCase()}`;
  const dateStr = data.bookingDate
    ? new Date(data.bookingDate).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : new Date().toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
  const txnRef = `TXN-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
  const formattedAmount = `₹${(data.amount || 0).toLocaleString("en-IN")}`;

  // Create a temporary hidden container formatted for A4 (794px width)
  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.left = "-9999px";
  container.style.top = "0";
  container.style.width = "794px";
  container.style.backgroundColor = "#ffffff";
  container.style.color = "#0f172a";
  container.style.fontFamily = "'Plus Jakarta Sans', 'Inter', system-ui, sans-serif";
  container.style.padding = "36px 40px";
  container.style.boxSizing = "border-box";

  container.innerHTML = `
    <div style="width: 100%; box-sizing: border-box;">
      <!-- Header with Logo and Company Info -->
      <table style="width: 100%; border-collapse: collapse; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 24px;">
        <tr>
          <td style="vertical-align: top; width: 60%;">
            <table style="border-collapse: collapse; margin-bottom: 10px;">
              <tr>
                <td style="vertical-align: middle; padding-right: 12px;">
                  <img src="${logoUrl}" alt="BLX Realty" style="height: 46px; width: auto; display: block;" />
                </td>
                <td style="vertical-align: middle;">
                  <div style="font-size: 22px; font-weight: 800; color: #1e1b4b; line-height: 1.1; letter-spacing: -0.5px;">BLX REALTY</div>
                  <div style="font-size: 10px; font-weight: 700; color: #6366f1; text-transform: uppercase; letter-spacing: 1.5px; margin-top: 2px;">Private Limited</div>
                </td>
              </tr>
            </table>
            <div style="font-size: 10.5px; color: #475569; line-height: 1.5;">
              <strong>Registered Office:</strong> #0301D, 3rd Floor, Tower 2, Brigade Twin Towers,<br />
              Pipeline Road, HMT, Yeswanthpur, Bengaluru, Karnataka - 560020<br />
              <strong>CIN:</strong> U68100KA2025PTC209397 &nbsp;|&nbsp; <strong>RERA Reg:</strong> PRM/KA/RERA/1251/310/PR/251006<br />
              <strong>GSTIN:</strong> 29AAACB1234F1Z8 &nbsp;|&nbsp; <strong>Phone:</strong> +91 81977 73166<br />
              <strong>Email:</strong> discoverblr@theblxrealty.com &nbsp;|&nbsp; <strong>Web:</strong> www.theblxrealty.com
            </div>
          </td>
          <td style="vertical-align: top; width: 40%; text-align: right;">
            <div style="display: inline-block; padding: 6px 16px; background-color: #4f46e5; color: #ffffff; font-size: 13px; font-weight: 800; border-radius: 6px; letter-spacing: 0.5px; text-transform: uppercase; margin-bottom: 12px;">
              TAX INVOICE
            </div>
            <div style="font-size: 11.5px; color: #334155; line-height: 1.6;">
              <div><span style="color: #64748b;">Invoice No:</span> <strong style="color: #0f172a;">${invoiceNum}</strong></div>
              <div><span style="color: #64748b;">Invoice Date:</span> <strong>${dateStr}</strong></div>
              <div><span style="color: #64748b;">Txn Ref:</span> <span style="font-family: monospace; font-weight: 700; color: #4f46e5;">${txnRef}</span></div>
              <div style="margin-top: 6px;">
                <span style="display: inline-block; padding: 3px 10px; background-color: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; font-size: 10px; font-weight: 800; border-radius: 9999px; text-transform: uppercase;">
                  ✓ PAID & CONFIRMED
                </span>
              </div>
            </div>
          </td>
        </tr>
      </table>

      <!-- Customer & Project Details Section -->
      <table style="width: 100%; border-collapse: separate; border-spacing: 0; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; margin-bottom: 24px;">
        <tr>
          <td style="width: 50%; padding: 18px 20px; vertical-align: top; border-right: 1px solid #e2e8f0;">
            <div style="font-size: 10px; font-weight: 800; color: #6366f1; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 6px;">BILLED TO (CLIENT DETAILS)</div>
            <div style="font-size: 15px; font-weight: 700; color: #0f172a; margin-bottom: 4px;">${data.customerName}</div>
            <div style="font-size: 11px; color: #475569; line-height: 1.5;">
              <div><strong>Client ID:</strong> ${data.leadId || "N/A"}</div>
              ${data.customerPhone ? `<div><strong>Phone:</strong> ${data.customerPhone}</div>` : ""}
              ${data.customerEmail ? `<div><strong>Email:</strong> ${data.customerEmail}</div>` : ""}
            </div>
          </td>
          <td style="width: 50%; padding: 18px 20px; vertical-align: top;">
            <div style="font-size: 10px; font-weight: 800; color: #6366f1; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 6px;">PROPERTY ALLOCATION DETAILS</div>
            <div style="font-size: 15px; font-weight: 700; color: #0f172a; margin-bottom: 4px;">${data.projectName || "BLX Realty Premium Listing"}</div>
            <div style="font-size: 11px; color: #475569; line-height: 1.5;">
              <div><strong>Allocated Unit ID:</strong> <span style="font-family: monospace; font-weight: 700; color: #4f46e5;">${data.unitNumber || "Standard Allocation"}</span></div>
              <div><strong>Booking Status:</strong> Verified & Reserved</div>
              <div><strong>Clearance Status:</strong> Payment Cleared</div>
            </div>
          </td>
        </tr>
      </table>

      <!-- Particulars Table -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 12px;">
        <thead>
          <tr style="background-color: #1e1b4b; color: #ffffff;">
            <th style="padding: 12px 16px; border-top-left-radius: 8px; font-weight: 700; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; text-align: left; vertical-align: middle;">Sl.</th>
            <th style="padding: 12px 16px; font-weight: 700; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; text-align: left; vertical-align: middle;">Item & Service Description</th>
            <th style="padding: 12px 16px; font-weight: 700; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; text-align: left; vertical-align: middle;">Category</th>
            <th style="padding: 12px 16px; border-top-right-radius: 8px; font-weight: 700; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; text-align: right; vertical-align: middle;">Amount (INR)</th>
          </tr>
        </thead>
        <tbody>
          <tr style="border-bottom: 1px solid #e2e8f0; background-color: #ffffff;">
            <td style="padding: 14px 16px; font-weight: 600; color: #64748b; vertical-align: middle;">01</td>
            <td style="padding: 14px 16px; vertical-align: middle;">
              <strong style="color: #0f172a; font-size: 13px; display: block; margin-bottom: 2px;">Unit Hold Reservation Fee / Initial Token Advance</strong>
              <span style="font-size: 11px; color: #64748b;">Unit No. ${data.unitNumber || "N/A"} in ${data.projectName || "Project"}</span>
            </td>
            <td style="padding: 14px 16px; color: #475569; font-weight: 600; vertical-align: middle;">Booking Advance</td>
            <td style="padding: 14px 16px; text-align: right; font-weight: 700; color: #0f172a; font-size: 13.5px; vertical-align: middle;">${formattedAmount}</td>
          </tr>
          <tr style="border-bottom: 1px solid #e2e8f0; background-color: #f8fafc;">
            <td style="padding: 14px 16px; font-weight: 600; color: #64748b; vertical-align: middle;">02</td>
            <td style="padding: 14px 16px; vertical-align: middle;">
              <strong style="color: #0f172a; font-size: 13px; display: block; margin-bottom: 2px;">Applicable Taxes (CGST 9% + SGST 9%)</strong>
              <span style="font-size: 11px; color: #64748b;">Inclusive of all government tax levies on token deposit</span>
            </td>
            <td style="padding: 14px 16px; color: #475569; font-weight: 600; vertical-align: middle;">GST (Included)</td>
            <td style="padding: 14px 16px; text-align: right; font-weight: 700; color: #10b981; font-size: 13.5px; vertical-align: middle;">₹0.00</td>
          </tr>
          <tr style="border-bottom: 1px solid #e2e8f0; background-color: #ffffff;">
            <td style="padding: 14px 16px; font-weight: 600; color: #64748b; vertical-align: middle;">03</td>
            <td style="padding: 14px 16px; vertical-align: middle;">
              <strong style="color: #0f172a; font-size: 13px; display: block; margin-bottom: 2px;">Legal Dossier & Property Verification Documentation</strong>
              <span style="font-size: 11px; color: #64748b;">Complimentary verification service provided by BLX Realty CRM</span>
            </td>
            <td style="padding: 14px 16px; color: #475569; font-weight: 600; vertical-align: middle;">Administrative</td>
            <td style="padding: 14px 16px; text-align: right; font-weight: 700; color: #6366f1; font-size: 13.5px; vertical-align: middle;">FREE</td>
          </tr>
        </tbody>
      </table>

      <!-- Summary & Bank Info Split -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
        <tr>
          <td style="width: 58%; vertical-align: top; padding-right: 12px;">
            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px;">
              <div style="font-size: 10px; font-weight: 800; color: #6366f1; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 8px;">OFFICIAL BANK & ESCROW ACCOUNT DETAILS</div>
              <div style="font-size: 11px; color: #334155; line-height: 1.6;">
                <div><strong>Bank Name:</strong> HDFC Bank Ltd</div>
                <div><strong>Account Name:</strong> BLX REALTY PRIVATE LIMITED - CLIENT ESCROW A/C</div>
                <div><strong>Account No:</strong> <span style="font-family: monospace; font-weight: 700;">50200089123456</span> &nbsp;|&nbsp; <strong>IFSC:</strong> HDFC0000240</div>
                <div><strong>Branch:</strong> Yeswanthpur Industrial Area Branch, Bengaluru</div>
              </div>
            </div>
          </td>
          <td style="width: 42%; vertical-align: top; padding-left: 12px;">
            <div style="background-color: #1e1b4b; color: #ffffff; border-radius: 10px; padding: 18px; text-align: right;">
              <div style="font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #a5b4fc; font-weight: 700;">TOTAL AMOUNT PAID</div>
              <div style="font-size: 26px; font-weight: 800; color: #ffffff; margin-top: 6px; margin-bottom: 4px; letter-spacing: -0.5px;">${formattedAmount}</div>
              <div style="font-size: 10px; color: #34d399; font-weight: 700;">✓ FULL AMOUNT RECEIVED</div>
            </div>
          </td>
        </tr>
      </table>

      <!-- Terms & Signature Section -->
      <table style="width: 100%; border-collapse: collapse; border-top: 2px dashed #cbd5e1; padding-top: 18px; margin-top: 12px;">
        <tr>
          <td style="width: 65%; vertical-align: top; padding-right: 16px;">
            <div style="font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">TERMS & CONDITIONS</div>
            <ul style="font-size: 10px; color: #64748b; padding-left: 14px; margin: 0; line-height: 1.5;">
              <li>This invoice is a digitally authenticated computer-generated receipt issued by BLX Realty Pvt Ltd.</li>
              <li>All holding deposits are governed by master agreement terms and applicable RERA guidelines.</li>
              <li>For any billing inquiries, contact corporate desk at discoverblr@theblxrealty.com.</li>
            </ul>
          </td>
          <td style="width: 35%; vertical-align: bottom; text-align: center;">
            <div style="font-size: 11px; font-weight: 800; color: #1e1b4b; margin-bottom: 8px; white-space: nowrap;">BLX REALTY PRIVATE LIMITED</div>
            <div style="margin-bottom: 8px;">
              <span style="font-size: 9px; color: #6366f1; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; border: 1.5px solid #6366f1; padding: 3px 12px; border-radius: 4px; display: inline-block;">
                SEAL & STAMP VERIFIED
              </span>
            </div>
            <div style="font-size: 10px; color: #64748b; font-style: italic;">Authorized Signatory</div>
          </td>
        </tr>
      </table>
    </div>
  `;

  document.body.appendChild(container);

  try {
    // Wait briefly for images and fonts to render
    await new Promise((r) => setTimeout(r, 250));

    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: "#ffffff",
      onclone: (clonedDoc) => {
        // Strip oklch() CSS functions from cloned document stylesheets to prevent html2canvas color parse errors
        const styleEls = clonedDoc.querySelectorAll("style");
        styleEls.forEach((s) => {
          if (s.textContent && s.textContent.includes("oklch")) {
            s.textContent = s.textContent.replace(/oklch\([^)]+\)/g, "#6366f1");
          }
        });
      },
    });

    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

    pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);

    const fileName = `Invoice_BLX_Realty_${data.customerName.replace(/\s+/g, "_")}.pdf`;
    pdf.save(fileName);
  } finally {
    document.body.removeChild(container);
  }
}
