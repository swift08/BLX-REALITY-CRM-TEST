import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import defaultLogoUrl from "@/assets/blx-logo.png";
import type { InvoiceSettings } from "@/lib/queries";

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
  customInvoiceNum?: string;
  customTxnRef?: string;
}

const DEFAULT_SETTINGS: InvoiceSettings = {
  id: "inv_settings_default",
  company_info: {
    company_name: "BLX REALITY PRIVATE LIMITED",
    logo_url: "",
    registered_address:
      "#301D, 3rd Floor, Tower B, Brigade Twin Towers, Pipeline Road HMT, Yeswanthpur, Bengaluru, Karnataka 560022",
    branch_address:
      "#301D, 3rd Floor, Tower B, Brigade Twin Towers, Pipeline Road HMT, Yeswanthpur, Bengaluru, Karnataka 560022",
    phone: "+91-9743264328 / +44-7944450039 / +91-8197773166",
    email: "discoverblr@theblxrealty.com",
    website: "www.theblxrealty.com",
    gst_number: "29AAOCB0144P1Z7",
    pan_number: "AAOCB0144P",
    cin: "U68100KA2025PTC209397",
    rera_number: "PRM/KA/RERA/1251/310/PR/251006",
  },

  banking_details: {
    bank_name: "HDFC Bank Ltd",
    account_holder: "BLX REALTY PRIVATE LIMITED - CLIENT ESCROW A/C",
    account_number: "50200089123456",
    ifsc_code: "HDFC0000240",
    branch_name: "Yeswanthpur Industrial Area Branch, Bengaluru",
    upi_id: "blxrealty@hdfcbank",
    qr_code_url: "",
  },
  tax_statutory: {
    gst_enabled: true,
    cgst_rate: 9,
    sgst_rate: 9,
    igst_rate: 18,
    tds_enabled: false,
    tds_rate: 1,
    pf_enabled: true,
    pf_code: "KAR/BLR/1098234/000",
    esi_enabled: true,
    esi_code: "53000981720000101",
    statutory_notes:
      "GST is applicable as per Ministry of Finance notification for Real Estate Services.",
  },
  invoice_notes: {
    payment_instructions:
      "Please make all payments via Bank Transfer / RTGS / NEFT or UPI strictly using official company accounts.",
    terms_and_conditions:
      "1. All booking advances are subject to final agreement terms.\n2. Holding deposits are valid for 15 days from issuance.\n3. This document is a computer-generated tax invoice.",
    cancellation_policy:
      "Cancellations within 7 days receive 90% refund. Post 7 days, cancellation is governed by RERA rules.",
    refund_policy:
      "Refunds are processed within 10 business days directly to the original bank account.",
    late_payment_policy:
      "1.5% monthly interest penalty applied on overdue installments beyond 15 days.",
    legal_disclaimer: "BLX Realty Pvt Ltd is a licensed RERA real estate agency.",
    thank_you_message: "Thank you for choosing BLX Realty as your trusted property partner!",
    customer_support: "Desk: +91 81977 73166 | support@theblxrealty.com",
  },
  branding: {
    logo_url: "",
    header_style: "modern",
    footer_info: "BLX Realty Pvt Ltd · Corporate Real Estate Advisory & Luxury Property Marketing",
    signature_title: "Authorized Signatory",
    signatory_name: "Nischith L. (Director)",
    signature_image_url: "",
    seal_image_url: "",
    primary_color: "#4f46e5",
    secondary_color: "#1e1b4b",
    text_color: "#0f172a",
  },
  numbering: {
    prefix: "INV-2026-",
    suffix: "/BLX",
    start_sequence: 1001,
    padding: 4,
    auto_increment: true,
  },
  payment_info: {
    accepted_methods: ["Bank Transfer (NEFT/RTGS)", "UPI Payment", "Cheque", "Demand Draft"],
    payment_due_instructions: "Payment due within 15 days of invoice date.",
    offline_instructions:
      "Deliver cheques favoring 'BLX REALTY PRIVATE LIMITED' at Corporate Office.",
    qr_instructions:
      "Scan UPI QR code using any UPI Banking App to complete instant token transfer.",
  },
  default_template_id: "modern_executive",
};

/**
 * Builds dynamic HTML string for the requested invoice template and CMS configuration.
 */
export function generateInvoiceHtmlContent(
  data: InvoiceData,
  settings: InvoiceSettings = DEFAULT_SETTINGS,
  overrideTemplateId?: string,
): string {
  const mergedSettings = { ...DEFAULT_SETTINGS, ...settings };
  const company = mergedSettings.company_info;
  const bank = mergedSettings.banking_details;
  const tax = mergedSettings.tax_statutory;
  const notes = mergedSettings.invoice_notes;
  const branding = mergedSettings.branding;
  const numbering = mergedSettings.numbering;
  const templateId = overrideTemplateId || mergedSettings.default_template_id || "modern_executive";

  const primaryColor = branding.primary_color || "#4f46e5";
  const secondaryColor = branding.secondary_color || "#1e1b4b";
  const logoSrc = branding.logo_url || company.logo_url || defaultLogoUrl;

  const invoiceNum =
    data.customInvoiceNum ||
    `${numbering.prefix || "INV-2026-"}${(data.bookingId || data.leadId || "1001")
      .replace(/[^a-zA-Z0-9]/g, "")
      .slice(-4)
      .padStart(numbering.padding || 4, "0")}${numbering.suffix || "/BLX"}`;

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

  const txnRef =
    data.customTxnRef || `TXN-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
  const formattedAmount = `₹${(data.amount || 0).toLocaleString("en-IN")}`;

  // Tax math calculation if GST enabled
  const baseAmount = data.amount || 0;
  const cgstAmount = tax.gst_enabled ? (baseAmount * (tax.cgst_rate || 9)) / 100 : 0;
  const sgstAmount = tax.gst_enabled ? (baseAmount * (tax.sgst_rate || 9)) / 100 : 0;
  const totalWithTax = baseAmount + cgstAmount + sgstAmount;
  const formattedTotalWithTax = `₹${totalWithTax.toLocaleString("en-IN")}`;

  // Template switchers
  if (templateId === "classic_corporate") {
    return `
    <div style="width: 794px; background: #ffffff; color: #0f172a; font-family: 'Inter', system-ui, sans-serif; padding: 36px 40px; box-sizing: border-box; border: 4px double ${secondaryColor}; border-radius: 4px;">
      <!-- Classic Corporate Header -->
      <table style="width: 100%; border-collapse: collapse; border-bottom: 2px solid #cbd5e1; padding-bottom: 16px; margin-bottom: 20px;">
        <tr>
          <td style="width: 65%; vertical-align: top;">
            <div style="font-size: 24px; font-weight: 900; color: ${secondaryColor}; text-transform: uppercase; letter-spacing: 0.5px;">${company.company_name}</div>
            <div style="font-size: 11px; color: #475569; margin-top: 6px; line-height: 1.5;">
              <div>${company.registered_address}</div>
              <div>Phone: ${company.phone} | Email: ${company.email}</div>
              <div>GSTIN: <strong>${company.gst_number}</strong> | PAN: <strong>${company.pan_number}</strong> | CIN: ${company.cin}</div>
              <div>RERA: ${company.rera_number}</div>
            </div>
          </td>
          <td style="width: 35%; vertical-align: top; text-align: right;">
            <div style="font-size: 22px; font-weight: 900; color: ${primaryColor}; text-transform: uppercase; letter-spacing: 1px;">OFFICIAL INVOICE</div>
            <div style="font-size: 11.5px; color: #334155; margin-top: 8px; line-height: 1.6;">
              <div><strong>No:</strong> ${invoiceNum}</div>
              <div><strong>Date:</strong> ${dateStr}</div>
              <div><strong>Ref:</strong> <span style="font-family: monospace;">${txnRef}</span></div>
            </div>
          </td>
        </tr>
      </table>

      <!-- Client & Allocation Split -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 11.5px;">
        <tr>
          <td style="width: 50%; padding: 14px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; vertical-align: top;">
            <div style="font-weight: 800; color: ${secondaryColor}; text-transform: uppercase; font-size: 10px; margin-bottom: 4px;">BILLED TO CLIENT</div>
            <div style="font-size: 14px; font-weight: 700;">${data.customerName}</div>
            <div>Phone: ${data.customerPhone || "N/A"}</div>
            <div>Email: ${data.customerEmail || "N/A"}</div>
          </td>
          <td style="width: 50%; padding: 14px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; vertical-align: top;">
            <div style="font-weight: 800; color: ${secondaryColor}; text-transform: uppercase; font-size: 10px; margin-bottom: 4px;">PROPERTY SPECIFICATION</div>
            <div style="font-size: 14px; font-weight: 700;">${data.projectName || "BLX Realty Project"}</div>
            <div>Unit Number: <strong>${data.unitNumber || "Standard Unit"}</strong></div>
            <div>Allocation: Verified & Booked</div>
          </td>
        </tr>
      </table>

      <!-- Particulars Table -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 11.5px; border: 1px solid #cbd5e1;">
        <thead>
          <tr style="background: ${secondaryColor}; color: #ffffff;">
            <th style="padding: 10px; text-align: left;">Item Description</th>
            <th style="padding: 10px; text-align: right;">Base Amount</th>
            <th style="padding: 10px; text-align: right;">CGST (${tax.cgst_rate}%)</th>
            <th style="padding: 10px; text-align: right;">SGST (${tax.sgst_rate}%)</th>
            <th style="padding: 10px; text-align: right;">Total Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="padding: 12px; border-bottom: 1px solid #e2e8f0;">
              <strong>Booking Advance / Hold Reservation Token</strong><br />
              <span style="font-size: 10px; color: #64748b;">${data.projectName} (Unit ${data.unitNumber})</span>
            </td>
            <td style="padding: 12px; text-align: right; border-bottom: 1px solid #e2e8f0;">${formattedAmount}</td>
            <td style="padding: 12px; text-align: right; border-bottom: 1px solid #e2e8f0;">₹${cgstAmount.toLocaleString("en-IN")}</td>
            <td style="padding: 12px; text-align: right; border-bottom: 1px solid #e2e8f0;">₹${sgstAmount.toLocaleString("en-IN")}</td>
            <td style="padding: 12px; text-align: right; font-weight: 800; border-bottom: 1px solid #e2e8f0;">${formattedTotalWithTax}</td>
          </tr>
        </tbody>
      </table>

      <!-- Banking Details & Total Box -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <tr>
          <td style="width: 60%; vertical-align: top; padding-right: 10px;">
            <div style="padding: 12px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 11px; background: #fafafa;">
              <strong style="color: ${secondaryColor}; font-size: 10px; text-transform: uppercase;">BANK ACCOUNT DETAILS</strong>
              <div>Bank: <strong>${bank.bank_name}</strong></div>
              <div>Account Name: ${bank.account_holder}</div>
              <div>A/C No: <strong>${bank.account_number}</strong> | IFSC: <strong>${bank.ifsc_code}</strong></div>
              <div>Branch: ${bank.branch_name}</div>
            </div>
          </td>
          <td style="width: 40%; vertical-align: top;">
            <div style="background: ${secondaryColor}; color: #ffffff; padding: 14px; border-radius: 6px; text-align: right;">
              <div style="font-size: 10px; text-transform: uppercase;">Grand Total Billed</div>
              <div style="font-size: 22px; font-weight: 800; margin-top: 4px;">${formattedTotalWithTax}</div>
              <div style="font-size: 9px; color: #34d399; font-weight: 700; margin-top: 2px;">✓ PAID IN FULL</div>
            </div>
          </td>
        </tr>
      </table>

      <!-- Notes & Footer -->
      <div style="font-size: 10px; color: #475569; border-top: 1px solid #cbd5e1; padding-top: 10px; margin-top: 10px;">
        <strong>Terms & Conditions:</strong>
        <div style="white-space: pre-wrap; margin-top: 4px;">${notes.terms_and_conditions}</div>
        <div style="margin-top: 8px; text-align: center; font-size: 9px; color: #64748b;">${branding.footer_info}</div>
      </div>
    </div>
    `;
  }

  if (templateId === "minimalist_clean") {
    return `
    <div style="width: 794px; background: #ffffff; color: #0f172a; font-family: 'Plus Jakarta Sans', system-ui, sans-serif; padding: 40px; box-sizing: border-box;">
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
        <tr>
          <td style="vertical-align: top;">
            <div style="font-size: 20px; font-weight: 800; color: #0f172a; letter-spacing: -0.5px;">${company.company_name}</div>
            <div style="font-size: 10px; color: #64748b; margin-top: 4px; line-height: 1.4;">
              ${company.registered_address}<br />
              ${company.email} · ${company.phone} · GSTIN: ${company.gst_number}
            </div>
          </td>
          <td style="vertical-align: top; text-align: right;">
            <div style="font-size: 24px; font-weight: 300; color: #64748b;">INVOICE</div>
            <div style="font-size: 11px; color: #0f172a; margin-top: 6px;">
              <strong>${invoiceNum}</strong><br />
              <span style="color: #64748b;">Date:</span> ${dateStr}
            </div>
          </td>
        </tr>
      </table>

      <div style="border-top: 1px solid #f1f5f9; border-bottom: 1px solid #f1f5f9; padding: 16px 0; margin-bottom: 30px;">
        <table style="width: 100%; font-size: 11.5px;">
          <tr>
            <td style="width: 50%; vertical-align: top;">
              <span style="font-size: 10px; text-transform: uppercase; color: #94a3b8; font-weight: 700;">Client</span>
              <div style="font-size: 14px; font-weight: 600; margin-top: 2px;">${data.customerName}</div>
              <div style="color: #64748b;">${data.customerEmail || ""}</div>
            </td>
            <td style="width: 50%; vertical-align: top; text-align: right;">
              <span style="font-size: 10px; text-transform: uppercase; color: #94a3b8; font-weight: 700;">Property</span>
              <div style="font-size: 14px; font-weight: 600; margin-top: 2px;">${data.projectName || "Listing Hold"}</div>
              <div style="color: #64748b;">Unit ${data.unitNumber || "N/A"}</div>
            </td>
          </tr>
        </table>
      </div>

      <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px; font-size: 12px;">
        <thead>
          <tr style="border-bottom: 2px solid #0f172a; text-transform: uppercase; font-size: 10px; letter-spacing: 0.5px;">
            <th style="padding: 8px 0; text-align: left;">Description</th>
            <th style="padding: 8px 0; text-align: right;">Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 14px 0;">
              <strong>Initial Booking Hold Deposit</strong>
              <div style="font-size: 11px; color: #64748b;">Advance token for unit reservation in ${data.projectName}</div>
            </td>
            <td style="padding: 14px 0; text-align: right; font-weight: 600;">${formattedAmount}</td>
          </tr>
        </tbody>
      </table>

      <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 30px;">
        <div style="font-size: 10.5px; color: #64748b; width: 60%;">
          <strong>Payment Method:</strong> ${bank.bank_name} (A/C: ${bank.account_number})<br />
          <strong>Support:</strong> ${notes.customer_support}
        </div>
        <div style="text-align: right; width: 40%;">
          <span style="font-size: 10px; color: #94a3b8; text-transform: uppercase;">Total Paid</span>
          <div style="font-size: 26px; font-weight: 800; color: #0f172a;">${formattedTotalWithTax}</div>
        </div>
      </div>

      <div style="font-size: 9.5px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 14px; text-align: center;">
        ${branding.footer_info}
      </div>
    </div>
    `;
  }

  if (templateId === "luxury_gold") {
    return `
    <div style="width: 794px; background: #0b0f17; color: #f8fafc; font-family: 'Plus Jakarta Sans', system-ui, sans-serif; padding: 40px; box-sizing: border-box; border: 1px solid #334155;">
      <!-- Luxury Dark & Gold Header -->
      <table style="width: 100%; border-collapse: collapse; border-bottom: 2px solid #d97706; padding-bottom: 20px; margin-bottom: 24px;">
        <tr>
          <td style="width: 60%; vertical-align: top;">
            <div style="font-size: 24px; font-weight: 900; color: #f59e0b; letter-spacing: 1px; text-transform: uppercase;">${company.company_name}</div>
            <div style="font-size: 10px; color: #cbd5e1; margin-top: 4px; line-height: 1.5;">
              <div>${company.registered_address}</div>
              <div>CIN: ${company.cin} | RERA: ${company.rera_number} | GSTIN: ${company.gst_number}</div>
              <div>Phone: ${company.phone} | Web: ${company.website}</div>
            </div>
          </td>
          <td style="width: 40%; vertical-align: top; text-align: right;">
            <div style="display: inline-block; padding: 6px 16px; background: linear-gradient(135deg, #d97706, #b45309); color: #ffffff; font-weight: 800; font-size: 12px; border-radius: 4px; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 10px;">
              TAX RECEIPT & INVOICE
            </div>
            <div style="font-size: 11px; color: #94a3b8; line-height: 1.6;">
              <div>Invoice No: <strong style="color: #f8fafc;">${invoiceNum}</strong></div>
              <div>Date: <strong style="color: #f8fafc;">${dateStr}</strong></div>
              <div>Txn Ref: <span style="font-family: monospace; color: #f59e0b;">${txnRef}</span></div>
            </div>
          </td>
        </tr>
      </table>

      <!-- Client & Project Box -->
      <table style="width: 100%; border-collapse: separate; border-spacing: 0; background: #1e293b; border: 1px solid #334155; border-radius: 8px; margin-bottom: 24px;">
        <tr>
          <td style="width: 50%; padding: 16px 20px; border-right: 1px solid #334155; vertical-align: top;">
            <div style="font-size: 10px; font-weight: 800; color: #f59e0b; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px;">VALUED CLIENT</div>
            <div style="font-size: 16px; font-weight: 700; color: #ffffff;">${data.customerName}</div>
            <div style="font-size: 11px; color: #cbd5e1; margin-top: 4px;">
              Phone: ${data.customerPhone || "N/A"}<br />
              Email: ${data.customerEmail || "N/A"}
            </div>
          </td>
          <td style="width: 50%; padding: 16px 20px; vertical-align: top;">
            <div style="font-size: 10px; font-weight: 800; color: #f59e0b; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px;">PROPERTY RESERVATION</div>
            <div style="font-size: 16px; font-weight: 700; color: #ffffff;">${data.projectName || "BLX Luxury Collection"}</div>
            <div style="font-size: 11px; color: #cbd5e1; margin-top: 4px;">
              Unit ID: <span style="font-family: monospace; color: #f59e0b; font-weight: 700;">${data.unitNumber || "Standard"}</span><br />
              Status: <span style="color: #34d399; font-weight: 700;">Confirmed & Hold Issued</span>
            </div>
          </td>
        </tr>
      </table>

      <!-- Particulars Table -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 12px; background: #0f172a; border-radius: 8px; overflow: hidden;">
        <thead>
          <tr style="background: #1e1b4b; color: #f59e0b; text-transform: uppercase; font-size: 11px;">
            <th style="padding: 12px 16px; text-align: left;">Description</th>
            <th style="padding: 12px 16px; text-align: right;">Amount (INR)</th>
          </tr>
        </thead>
        <tbody>
          <tr style="border-bottom: 1px solid #1e293b;">
            <td style="padding: 16px;">
              <strong style="font-size: 13px; color: #ffffff; display: block;">Unit Hold Reservation Deposit</strong>
              <span style="font-size: 11px; color: #94a3b8;">Advance token towards property reservation at ${data.projectName}</span>
            </td>
            <td style="padding: 16px; text-align: right; font-weight: 800; font-size: 14px; color: #ffffff;">${formattedAmount}</td>
          </tr>
        </tbody>
      </table>

      <!-- Bank & Summary Box -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
        <tr>
          <td style="width: 60%; vertical-align: top; padding-right: 12px;">
            <div style="background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 14px; font-size: 11px; color: #cbd5e1;">
              <div style="font-size: 10px; font-weight: 800; color: #f59e0b; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 6px;">OFFICIAL ESCROW BANK ACCOUNT</div>
              <div>Bank: <strong>${bank.bank_name}</strong></div>
              <div>Account Name: ${bank.account_holder}</div>
              <div>A/C No: <span style="font-family: monospace; font-weight: 700; color: #ffffff;">${bank.account_number}</span> | IFSC: <span style="font-family: monospace; font-weight: 700; color: #ffffff;">${bank.ifsc_code}</span></div>
              <div>Branch: ${bank.branch_name}</div>
            </div>
          </td>
          <td style="width: 40%; vertical-align: top;">
            <div style="background: linear-gradient(135deg, #1e1b4b, #311b92); border: 1px solid #d97706; border-radius: 8px; padding: 16px; text-align: right;">
              <div style="font-size: 10px; color: #f59e0b; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">TOTAL RECEIVED</div>
              <div style="font-size: 24px; font-weight: 900; color: #ffffff; margin-top: 4px;">${formattedTotalWithTax}</div>
              <div style="font-size: 10px; color: #34d399; font-weight: 700; margin-top: 4px;">✓ FULLY CONFIRMED</div>
            </div>
          </td>
        </tr>
      </table>

      <!-- Footer -->
      <div style="border-top: 1px dashed #334155; padding-top: 14px; font-size: 10px; color: #94a3b8; display: flex; justify-content: space-between;">
        <div>${branding.signatory_name} (${branding.signature_title})</div>
        <div>${branding.footer_info}</div>
      </div>
    </div>
    `;
  }

  // Modern Executive (Default Layout)
  return `
    <div style="width: 794px; background: #ffffff; color: ${branding.text_color || "#0f172a"}; font-family: 'Plus Jakarta Sans', 'Inter', system-ui, sans-serif; padding: 36px 40px; box-sizing: border-box;">
      <!-- Modern Header with Dynamic Brand Accent -->
      <table style="width: 100%; border-collapse: collapse; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 24px;">
        <tr>
          <td style="vertical-align: top; width: 60%;">
            <table style="border-collapse: collapse; margin-bottom: 10px;">
              <tr>
                <td style="vertical-align: middle; padding-right: 12px;">
                  <img src="${logoSrc}" alt="${company.company_name}" style="height: 46px; width: auto; display: block;" />
                </td>
                <td style="vertical-align: middle;">
                  <div style="font-size: 22px; font-weight: 800; color: ${secondaryColor}; line-height: 1.1; letter-spacing: -0.5px;">${company.company_name.toUpperCase()}</div>
                  <div style="font-size: 10px; font-weight: 700; color: ${primaryColor}; text-transform: uppercase; letter-spacing: 1.5px; margin-top: 2px;">Private Limited</div>
                </td>
              </tr>
            </table>
            <div style="font-size: 10.5px; color: #475569; line-height: 1.5;">
              <strong>Registered Office:</strong> ${company.registered_address}<br />
              <strong>CIN:</strong> ${company.cin} &nbsp;|&nbsp; <strong>RERA Reg:</strong> ${company.rera_number}<br />
              <strong>GSTIN:</strong> ${company.gst_number} &nbsp;|&nbsp; <strong>PAN:</strong> ${company.pan_number}<br />
              <strong>Phone:</strong> ${company.phone} &nbsp;|&nbsp; <strong>Email:</strong> ${company.email}
            </div>
          </td>
          <td style="vertical-align: top; width: 40%; text-align: right;">
            <div style="display: inline-block; padding: 6px 16px; background-color: ${primaryColor}; color: #ffffff; font-size: 13px; font-weight: 800; border-radius: 6px; letter-spacing: 0.5px; text-transform: uppercase; margin-bottom: 12px;">
              TAX INVOICE
            </div>
            <div style="font-size: 11.5px; color: #334155; line-height: 1.6;">
              <div><span style="color: #64748b;">Invoice No:</span> <strong style="color: #0f172a;">${invoiceNum}</strong></div>
              <div><span style="color: #64748b;">Invoice Date:</span> <strong>${dateStr}</strong></div>
              <div><span style="color: #64748b;">Txn Ref:</span> <span style="font-family: monospace; font-weight: 700; color: ${primaryColor};">${txnRef}</span></div>
              <div style="margin-top: 6px;">
                <span style="display: inline-block; padding: 3px 10px; background-color: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; font-size: 10px; font-weight: 800; border-radius: 9999px; text-transform: uppercase;">
                  ✓ PAID & CONFIRMED
                </span>
              </div>
            </div>
          </td>
        </tr>
      </table>

      <!-- Customer & Allocation Section -->
      <table style="width: 100%; border-collapse: separate; border-spacing: 0; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; margin-bottom: 24px;">
        <tr>
          <td style="width: 50%; padding: 18px 20px; vertical-align: top; border-right: 1px solid #e2e8f0;">
            <div style="font-size: 10px; font-weight: 800; color: ${primaryColor}; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 6px;">BILLED TO (CLIENT DETAILS)</div>
            <div style="font-size: 15px; font-weight: 700; color: #0f172a; margin-bottom: 4px;">${data.customerName}</div>
            <div style="font-size: 11px; color: #475569; line-height: 1.5;">
              <div><strong>Client ID:</strong> ${data.leadId || "N/A"}</div>
              ${data.customerPhone ? `<div><strong>Phone:</strong> ${data.customerPhone}</div>` : ""}
              ${data.customerEmail ? `<div><strong>Email:</strong> ${data.customerEmail}</div>` : ""}
            </div>
          </td>
          <td style="width: 50%; padding: 18px 20px; vertical-align: top;">
            <div style="font-size: 10px; font-weight: 800; color: ${primaryColor}; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 6px;">PROPERTY ALLOCATION DETAILS</div>
            <div style="font-size: 15px; font-weight: 700; color: #0f172a; margin-bottom: 4px;">${data.projectName || "BLX Premium Listing"}</div>
            <div style="font-size: 11px; color: #475569; line-height: 1.5;">
              <div><strong>Allocated Unit ID:</strong> <span style="font-family: monospace; font-weight: 700; color: ${primaryColor};">${data.unitNumber || "Standard Allocation"}</span></div>
              <div><strong>Booking Status:</strong> Verified & Reserved</div>
              <div><strong>Clearance Status:</strong> Payment Cleared</div>
            </div>
          </td>
        </tr>
      </table>

      <!-- Particulars Table -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 12px;">
        <thead>
          <tr style="background-color: ${secondaryColor}; color: #ffffff;">
            <th style="padding: 12px 16px; border-top-left-radius: 8px; font-weight: 700; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; text-align: left;">Sl.</th>
            <th style="padding: 12px 16px; font-weight: 700; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; text-align: left;">Item & Service Description</th>
            <th style="padding: 12px 16px; font-weight: 700; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; text-align: left;">Category</th>
            <th style="padding: 12px 16px; border-top-right-radius: 8px; font-weight: 700; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; text-align: right;">Amount (INR)</th>
          </tr>
        </thead>
        <tbody>
          <tr style="border-bottom: 1px solid #e2e8f0; background-color: #ffffff;">
            <td style="padding: 14px 16px; font-weight: 600; color: #64748b;">01</td>
            <td style="padding: 14px 16px;">
              <strong style="color: #0f172a; font-size: 13px; display: block; margin-bottom: 2px;">Unit Hold Reservation Fee / Initial Token Advance</strong>
              <span style="font-size: 11px; color: #64748b;">Unit No. ${data.unitNumber || "N/A"} in ${data.projectName || "Project"}</span>
            </td>
            <td style="padding: 14px 16px; color: #475569; font-weight: 600;">Booking Advance</td>
            <td style="padding: 14px 16px; text-align: right; font-weight: 700; color: #0f172a; font-size: 13.5px;">${formattedAmount}</td>
          </tr>
          ${
            tax.gst_enabled
              ? `
          <tr style="border-bottom: 1px solid #e2e8f0; background-color: #f8fafc;">
            <td style="padding: 14px 16px; font-weight: 600; color: #64748b;">02</td>
            <td style="padding: 14px 16px;">
              <strong style="color: #0f172a; font-size: 13px; display: block; margin-bottom: 2px;">Applicable Taxes (CGST ${tax.cgst_rate}% + SGST ${tax.sgst_rate}%)</strong>
              <span style="font-size: 11px; color: #64748b;">Calculated on token deposit</span>
            </td>
            <td style="padding: 14px 16px; color: #475569; font-weight: 600;">GST (${tax.cgst_rate + tax.sgst_rate}%)</td>
            <td style="padding: 14px 16px; text-align: right; font-weight: 700; color: #10b981; font-size: 13.5px;">₹${(cgstAmount + sgstAmount).toLocaleString("en-IN")}</td>
          </tr>
          `
              : ""
          }
        </tbody>
      </table>

      <!-- Summary & Bank Info Split -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
        <tr>
          <td style="width: 58%; vertical-align: top; padding-right: 12px;">
            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px;">
              <div style="font-size: 10px; font-weight: 800; color: ${primaryColor}; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 8px;">OFFICIAL BANK & ESCROW ACCOUNT DETAILS</div>
              <div style="font-size: 11px; color: #334155; line-height: 1.6;">
                <div><strong>Bank Name:</strong> ${bank.bank_name}</div>
                <div><strong>Account Name:</strong> ${bank.account_holder}</div>
                <div><strong>Account No:</strong> <span style="font-family: monospace; font-weight: 700;">${bank.account_number}</span> &nbsp;|&nbsp; <strong>IFSC:</strong> ${bank.ifsc_code}</div>
                <div><strong>Branch:</strong> ${bank.branch_name}</div>
                ${bank.upi_id ? `<div><strong>UPI ID:</strong> <span style="font-weight: 700; color: ${primaryColor};">${bank.upi_id}</span></div>` : ""}
              </div>
            </div>
          </td>
          <td style="width: 42%; vertical-align: top; padding-left: 12px;">
            <div style="background-color: ${secondaryColor}; color: #ffffff; border-radius: 10px; padding: 18px; text-align: right;">
              <div style="font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #a5b4fc; font-weight: 700;">TOTAL AMOUNT PAID</div>
              <div style="font-size: 26px; font-weight: 800; color: #ffffff; margin-top: 6px; margin-bottom: 4px; letter-spacing: -0.5px;">${formattedTotalWithTax}</div>
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
            <div style="font-size: 10px; color: #64748b; line-height: 1.5; white-space: pre-wrap;">${notes.terms_and_conditions}</div>
          </td>
          <td style="width: 35%; vertical-align: bottom; text-align: center;">
            <div style="font-size: 11px; font-weight: 800; color: ${secondaryColor}; margin-bottom: 8px; white-space: nowrap;">${company.company_name.toUpperCase()}</div>
            <div style="margin-bottom: 8px;">
              <span style="font-size: 9px; color: ${primaryColor}; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; border: 1.5px solid ${primaryColor}; padding: 3px 12px; border-radius: 4px; display: inline-block;">
                SEAL & STAMP VERIFIED
              </span>
            </div>
            <div style="font-size: 10px; color: #64748b; font-weight: 600;">${branding.signatory_name || "Authorized Signatory"}</div>
            <div style="font-size: 9px; color: #94a3b8; font-style: italic;">${branding.signature_title || "Authorized Signatory"}</div>
          </td>
        </tr>
      </table>
    </div>
  `;
}

/**
 * Generates and downloads an A4 PDF Tax Invoice using html2canvas & jsPDF.
 */
export async function downloadPdfInvoice(
  data: InvoiceData,
  settings?: InvoiceSettings,
  overrideTemplateId?: string,
) {
  const htmlStr = generateInvoiceHtmlContent(data, settings, overrideTemplateId);

  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.left = "-9999px";
  container.style.top = "0";
  container.style.width = "794px";
  container.style.backgroundColor = "#ffffff";

  container.innerHTML = htmlStr;
  document.body.appendChild(container);

  try {
    await new Promise((r) => setTimeout(r, 250));

    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: "#ffffff",
      onclone: (clonedDoc) => {
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

    const fileName = `Invoice_${data.customerName.replace(/\s+/g, "_")}.pdf`;
    pdf.save(fileName);
  } finally {
    document.body.removeChild(container);
  }
}

export interface PaymentReceiptData {
  receiptNumber: string;
  invoiceNumber: string;
  customerName: string;
  projectName: string;
  unitNumber: string;
  amountPaid: number;
  paymentMethod: string;
  reference: string;
  date: string;
}

/**
 * Generates and downloads an official Payment Receipt & Escrow Clearance Certificate PDF.
 */
export async function generatePaymentReceiptPdf(
  data: PaymentReceiptData,
  settings?: InvoiceSettings,
) {
  const company = settings?.company_info || {
    company_name: "BLX Realty Group",
    address: "Level 14, BLX Financial Centre, MG Road, Bengaluru - 560001",
    phone: "+91 80 4567 8900",
    email: "finance@theblxrealty.com",
    gstin: "29AAAAA0000A1Z5",
  };

  const branding = settings?.branding || {
    primary_color: "#0f172a",
    secondary_color: "#1e293b",
    company_seal_url: "",
    authorized_signatory: "Managing Director / Financial Officer",
    footer_info: "Official Payment Receipt issued under BLX Escrow Audit Rules.",
  };

  const formattedAmount = `₹${Number(data.amountPaid).toLocaleString("en-IN")}`;
  const formattedDate = new Date(data.date).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const htmlStr = `
  <div style="width: 794px; background: #ffffff; color: #0f172a; font-family: 'Plus Jakarta Sans', system-ui, sans-serif; padding: 40px; box-sizing: border-box;">
    <!-- Top Header -->
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px; border-b: 2px solid ${branding.primary_color}; padding-bottom: 16px;">
      <tr>
        <td style="vertical-align: top;">
          <div style="font-size: 24px; font-weight: 800; color: ${branding.primary_color}; font-family: sans-serif;">${company.company_name}</div>
          <div style="font-size: 11px; color: #475569; margin-top: 4px;">${(company as any).address || (company as any).registered_address || "Level 14, BLX Financial Centre, MG Road, Bengaluru - 560001"}</div>
          <div style="font-size: 11px; color: #475569;">GSTIN: <strong>${(company as any).gstin || (company as any).gst_number || "29AAAAA0000A1Z5"}</strong> | Phone: ${company.phone}</div>
        </td>
        <td style="text-align: right; vertical-align: top;">
          <div style="font-size: 20px; font-weight: 800; color: #059669; text-transform: uppercase;">OFFICIAL PAYMENT RECEIPT</div>
          <div style="font-size: 12px; font-weight: 700; color: #0f172a; margin-top: 4px;">Receipt #${data.receiptNumber}</div>
          <div style="font-size: 11px; color: #64748b;">Issued: ${formattedDate}</div>
        </td>
      </tr>
    </table>

    <!-- Receipt Info Grid -->
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
      <tr>
        <td style="width: 50%; padding: 14px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; vertical-align: top;">
          <div style="font-weight: 800; color: ${branding.primary_color}; text-transform: uppercase; font-size: 10px; margin-bottom: 6px;">RECEIVED FROM CLIENT</div>
          <div style="font-size: 15px; font-weight: 800;">${data.customerName}</div>
          <div style="font-size: 11px; color: #475569; margin-top: 4px;">Property: <strong>${data.projectName}</strong></div>
          <div style="font-size: 11px; color: #475569;">Allocated Unit: <strong>${data.unitNumber}</strong></div>
        </td>
        <td style="width: 50%; padding: 14px; background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; vertical-align: top; margin-left: 10px;">
          <div style="font-weight: 800; color: #047857; text-transform: uppercase; font-size: 10px; margin-bottom: 6px;">TRANSACTION DETAILS</div>
          <div style="font-size: 11px; color: #065f46;">Tax Invoice Ref: <strong>${data.invoiceNumber}</strong></div>
          <div style="font-size: 11px; color: #065f46;">Payment Mode: <strong>${data.paymentMethod.replace("_", " ").toUpperCase()}</strong></div>
          <div style="font-size: 11px; color: #065f46;">Transaction Ref / UTR: <strong>${data.reference}</strong></div>
        </td>
      </tr>
    </table>

    <!-- Amount Received Box -->
    <div style="background: #047857; color: #ffffff; padding: 20px; border-radius: 8px; text-align: center; margin-bottom: 30px;">
      <div style="font-size: 12px; text-transform: uppercase; letter-spacing: 1px; font-weight: 700;">TOTAL AMOUNT RECEIVED & ESCROW CLEARED</div>
      <div style="font-size: 32px; font-weight: 900; margin-top: 6px;">${formattedAmount}</div>
      <div style="font-size: 11px; color: #a7f3d0; margin-top: 4px; font-weight: 600;">✓ Verification Confirmed — Official Escrow Credit</div>
    </div>

    <!-- Signatory & Stamp -->
    <table style="width: 100%; border-collapse: collapse; margin-top: 40px;">
      <tr>
        <td style="vertical-align: bottom;">
          <div style="font-size: 10px; color: #64748b;">${branding.footer_info}</div>
          <div style="font-size: 10px; color: #94a3b8; margin-top: 4px;">System Generated Certified Financial Receipt</div>
        </td>
        <td style="text-align: right; vertical-align: bottom; width: 220px;">
          <div style="border-bottom: 1.5px solid #0f172a; padding-bottom: 4px; margin-bottom: 4px; font-size: 12px; font-weight: 800;">${(branding as any).authorized_signatory || (branding as any).signatory_name || "Managing Director / Financial Officer"}</div>
          <div style="font-size: 10px; color: #475569;">Authorized Financial Officer</div>
        </td>
      </tr>
    </table>
  </div>
  `;

  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.left = "-9999px";
  container.style.top = "0";
  container.style.width = "794px";
  container.style.backgroundColor = "#ffffff";

  container.innerHTML = htmlStr;
  document.body.appendChild(container);

  try {
    await new Promise((r) => setTimeout(r, 250));

    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: "#ffffff",
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

    const fileName = `Payment_Receipt_${data.receiptNumber}.pdf`;
    pdf.save(fileName);
  } finally {
    document.body.removeChild(container);
  }
}

export interface DemandLetterData {
  demandNumber: string;
  bookingId: string;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  projectName: string;
  unitNumber: string;
  milestoneName: string;
  milestoneAmount: number;
  dueDate: string;
}

/**
 * Generates and downloads an official Payment Demand Letter PDF for construction milestones.
 */
export async function downloadDemandLetterPdf(data: DemandLetterData, settings?: InvoiceSettings) {
  const company = settings?.company_info || {
    company_name: "BLX Realty Group",
    address: "Level 14, BLX Financial Centre, MG Road, Bengaluru - 560001",
    phone: "+91 80 4567 8900",
    email: "finance@theblxrealty.com",
    gstin: "29AAAAA0000A1Z5",
  };

  const bank = settings?.banking_details || {
    bank_name: "HDFC Bank Ltd.",
    account_number: "50200012345678",
    ifsc_code: "HDFC0001234",
    account_holder: "BLX Realty Escrow Account",
    branch_name: "MG Road Branch",
  };

  const branding = settings?.branding || {
    primary_color: "#0f172a",
    authorized_signatory: "Managing Director / Operations Officer",
    footer_info: "Official Payment Demand Letter issued under RERA Construction Rules.",
  };

  const formattedAmount = `₹${Number(data.milestoneAmount).toLocaleString("en-IN")}`;
  const formattedDueDate = new Date(data.dueDate).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const htmlStr = `
  <div style="width: 794px; background: #ffffff; color: #0f172a; font-family: 'Plus Jakarta Sans', system-ui, sans-serif; padding: 40px; box-sizing: border-box;">
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px; border-b: 2px solid ${branding.primary_color}; padding-bottom: 16px;">
      <tr>
        <td style="vertical-align: top;">
          <div style="font-size: 24px; font-weight: 800; color: ${branding.primary_color}; font-family: sans-serif;">${company.company_name}</div>
          <div style="font-size: 11px; color: #475569; margin-top: 4px;">${(company as any).address || (company as any).registered_address || "Level 14, BLX Financial Centre, MG Road, Bengaluru - 560001"}</div>
          <div style="font-size: 11px; color: #475569;">GSTIN: <strong>${(company as any).gstin || (company as any).gst_number || "29AAAAA0000A1Z5"}</strong> | Phone: ${company.phone}</div>
        </td>
        <td style="text-align: right; vertical-align: top;">
          <div style="font-size: 18px; font-weight: 800; color: #dc2626; text-transform: uppercase;">PAYMENT DEMAND LETTER</div>
          <div style="font-size: 12px; font-weight: 700; color: #0f172a; margin-top: 4px;">Demand Ref #${data.demandNumber}</div>
          <div style="font-size: 11px; color: #64748b;">Due Date: <strong>${formattedDueDate}</strong></div>
        </td>
      </tr>
    </table>

    <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
      <tr>
        <td style="width: 50%; padding: 14px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; vertical-align: top;">
          <div style="font-weight: 800; color: ${branding.primary_color}; text-transform: uppercase; font-size: 10px; margin-bottom: 6px;">TO VALUED CLIENT</div>
          <div style="font-size: 15px; font-weight: 800;">${data.customerName}</div>
          <div style="font-size: 11px; color: #475569; margin-top: 4px;">Phone: ${data.customerPhone || "N/A"}</div>
          <div style="font-size: 11px; color: #475569;">Email: ${data.customerEmail || "N/A"}</div>
        </td>
        <td style="width: 50%; padding: 14px; background: #fef2f2; border: 1px solid #fca5a5; border-radius: 8px; vertical-align: top; margin-left: 10px;">
          <div style="font-weight: 800; color: #991b1b; text-transform: uppercase; font-size: 10px; margin-bottom: 6px;">PROPERTY & MILESTONE</div>
          <div style="font-size: 13px; font-weight: 800; color: #7f1d1d;">${data.projectName}</div>
          <div style="font-size: 11px; color: #991b1b; margin-top: 2px;">Allocated Unit: <strong>${data.unitNumber}</strong></div>
          <div style="font-size: 11px; color: #991b1b; margin-top: 2px;">Milestone Stage: <strong>${data.milestoneName}</strong></div>
        </td>
      </tr>
    </table>

    <div style="background: #991b1b; color: #ffffff; padding: 20px; border-radius: 8px; text-align: center; margin-bottom: 24px;">
      <div style="font-size: 11px; text-transform: uppercase; font-weight: 700; letter-spacing: 1px;">MILESTONE AMOUNT PAYABLE</div>
      <div style="font-size: 32px; font-weight: 900; margin-top: 4px;">${formattedAmount}</div>
      <div style="font-size: 11px; color: #fecaca; margin-top: 4px;">Please remit payment on or before <strong>${formattedDueDate}</strong></div>
    </div>

    <div style="padding: 14px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 11px; background: #f8fafc; margin-bottom: 30px;">
      <strong style="color: ${branding.primary_color}; font-size: 10px; text-transform: uppercase;">ESCROW BANK PAYMENT DETAILS</strong>
      <div>Bank Name: <strong>${bank.bank_name}</strong></div>
      <div>Account Name: ${bank.account_holder}</div>
      <div>Account Number: <strong>${bank.account_number}</strong> | IFSC Code: <strong>${bank.ifsc_code}</strong></div>
      <div>Branch: ${bank.branch_name}</div>
    </div>

    <table style="width: 100%; border-collapse: collapse;">
      <tr>
        <td style="vertical-align: bottom;">
          <div style="font-size: 10px; color: #64748b;">${branding.footer_info}</div>
        </td>
        <td style="text-align: right; vertical-align: bottom; width: 220px;">
          <div style="border-bottom: 1.5px solid #0f172a; padding-bottom: 4px; margin-bottom: 4px; font-size: 12px; font-weight: 800;">${(branding as any).authorized_signatory || (branding as any).signatory_name || "Managing Director / Operations Officer"}</div>
          <div style="font-size: 10px; color: #475569;">Authorized Operations Officer</div>
        </td>
      </tr>
    </table>
  </div>
  `;

  await downloadHtmlAsPdf(htmlStr, `Demand_Letter_${data.demandNumber}.pdf`);
}

export async function downloadCustomerStatementPdf(data: any, settings?: InvoiceSettings) {
  const company = settings?.company_info || {
    company_name: "BLX Realty Group",
    address: "Level 14, BLX Financial Centre, MG Road, Bengaluru - 560001",
    phone: "+91 80 4567 8900",
    email: "finance@theblxrealty.com",
    gstin: "29AAAAA0000A1Z5",
  };

  const branding = settings?.branding || {
    primary_color: "#0f172a",
    authorized_signatory: "Managing Director / Chief Financial Officer",
    footer_info: "Official Customer Financial Ledger Statement generated under BLX CRM System.",
  };

  const htmlStr = `
  <div style="width: 794px; background: #ffffff; color: #0f172a; font-family: 'Plus Jakarta Sans', system-ui, sans-serif; padding: 40px; box-sizing: border-box;">
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px; border-b: 2px solid ${branding.primary_color}; padding-bottom: 16px;">
      <tr>
        <td style="vertical-align: top;">
          <div style="font-size: 24px; font-weight: 800; color: ${branding.primary_color}; font-family: sans-serif;">${company.company_name}</div>
          <div style="font-size: 11px; color: #475569; margin-top: 4px;">${(company as any).address || (company as any).registered_address || "Level 14, BLX Financial Centre, MG Road, Bengaluru - 560001"}</div>
        </td>
        <td style="text-align: right; vertical-align: top;">
          <div style="font-size: 18px; font-weight: 800; color: ${branding.primary_color}; text-transform: uppercase;">UNIFIED FINANCIAL STATEMENT</div>
          <div style="font-size: 11px; color: #64748b; margin-top: 4px;">Generated: ${new Date().toLocaleDateString("en-IN")}</div>
        </td>
      </tr>
    </table>

    <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
      <tr>
        <td style="width: 50%; padding: 14px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px;">
          <div style="font-size: 10px; font-weight: 800; color: ${branding.primary_color}; text-transform: uppercase;">CLIENT DOSSIER</div>
          <div style="font-size: 15px; font-weight: 800;">${data.customerName}</div>
          <div style="font-size: 11px; color: #475569;">Phone: ${data.customerPhone || "N/A"}</div>
          <div style="font-size: 11px; color: #475569;">Email: ${data.customerEmail || "N/A"}</div>
        </td>
        <td style="width: 50%; padding: 14px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; text-align: right;">
          <div style="font-size: 11px; color: #475569;">Total Contract Billed: <strong>₹${Number(data.totalBilled || 0).toLocaleString("en-IN")}</strong></div>
          <div style="font-size: 11px; color: #059669;">Total Collections Received: <strong>₹${Number(data.totalCollected || 0).toLocaleString("en-IN")}</strong></div>
          <div style="font-size: 14px; font-weight: 800; color: #dc2626; margin-top: 4px;">Outstanding Balance: ₹${Number(data.outstandingBalance || 0).toLocaleString("en-IN")}</div>
        </td>
      </tr>
    </table>

    <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px; font-size: 11px; border: 1px solid #cbd5e1;">
      <thead>
        <tr style="background: ${branding.primary_color}; color: #ffffff; font-size: 10px; text-transform: uppercase;">
          <th style="padding: 8px; text-align: left;">Date</th>
          <th style="padding: 8px; text-align: left;">Document / Voucher</th>
          <th style="padding: 8px; text-align: left;">Description</th>
          <th style="padding: 8px; text-align: right;">Billed (Debit)</th>
          <th style="padding: 8px; text-align: right;">Paid (Credit)</th>
        </tr>
      </thead>
      <tbody>
        ${(data.items || [])
          .map(
            (it: any) => `
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 8px; color: #475569;">${new Date(it.date).toLocaleDateString("en-IN")}</td>
            <td style="padding: 8px; font-weight: 700;">${it.reference}</td>
            <td style="padding: 8px;">${it.description}</td>
            <td style="padding: 8px; text-align: right; font-weight: 700;">${it.debit ? `₹${Number(it.debit).toLocaleString("en-IN")}` : "-"}</td>
            <td style="padding: 8px; text-align: right; font-weight: 700; color: #059669;">${it.credit ? `₹${Number(it.credit).toLocaleString("en-IN")}` : "-"}</td>
          </tr>
        `,
          )
          .join("")}
      </tbody>
    </table>

    <table style="width: 100%; border-collapse: collapse;">
      <tr>
        <td style="vertical-align: bottom;">
          <div style="font-size: 10px; color: #64748b;">${branding.footer_info}</div>
        </td>
        <td style="text-align: right; vertical-align: bottom; width: 220px;">
          <div style="border-bottom: 1.5px solid #0f172a; padding-bottom: 4px; margin-bottom: 4px; font-size: 12px; font-weight: 800;">${(branding as any).authorized_signatory || (branding as any).signatory_name || "Managing Director / Chief Financial Officer"}</div>
          <div style="font-size: 10px; color: #475569;">Authorized Signatory</div>
        </td>
      </tr>
    </table>
  </div>
  `;

  await downloadHtmlAsPdf(
    htmlStr,
    `Financial_Statement_${data.customerName.replace(/\s+/g, "_")}.pdf`,
  );
}

export async function downloadRefundReceiptPdf(data: any, settings?: InvoiceSettings) {
  const company = settings?.company_info || {
    company_name: "BLX Realty Group",
    address: "Level 14, BLX Financial Centre, MG Road, Bengaluru - 560001",
    phone: "+91 80 4567 8900",
    email: "finance@theblxrealty.com",
    gstin: "29AAAAA0000A1Z5",
  };

  const branding = settings?.branding || {
    primary_color: "#0f172a",
    authorized_signatory: "Managing Director / Financial Officer",
    footer_info: "Official Cancellation Refund Voucher issued under BLX Legal Rules.",
  };

  const htmlStr = `
  <div style="width: 794px; background: #ffffff; color: #0f172a; font-family: 'Plus Jakarta Sans', system-ui, sans-serif; padding: 40px; box-sizing: border-box;">
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px; border-b: 2px solid ${branding.primary_color}; padding-bottom: 16px;">
      <tr>
        <td style="vertical-align: top;">
          <div style="font-size: 24px; font-weight: 800; color: ${branding.primary_color}; font-family: sans-serif;">${company.company_name}</div>
          <div style="font-size: 11px; color: #475569; margin-top: 4px;">${(company as any).address || (company as any).registered_address || "Level 14, BLX Financial Centre, MG Road, Bengaluru - 560001"}</div>
        </td>
        <td style="text-align: right; vertical-align: top;">
          <div style="font-size: 18px; font-weight: 800; color: #dc2626; text-transform: uppercase;">REFUND VOUCHER RECEIPT</div>
          <div style="font-size: 12px; font-weight: 700; color: #0f172a; margin-top: 4px;">Voucher #${data.voucherNumber}</div>
        </td>
      </tr>
    </table>

    <div style="background: #dc2626; color: #ffffff; padding: 20px; border-radius: 8px; text-align: center; margin-bottom: 24px;">
      <div style="font-size: 11px; text-transform: uppercase; font-weight: 700; letter-spacing: 1px;">TOTAL REFUND REMITTED</div>
      <div style="font-size: 32px; font-weight: 900; margin-top: 4px;">₹${Number(data.approvedAmount).toLocaleString("en-IN")}</div>
      <div style="font-size: 11px; color: #fecaca; margin-top: 4px;">Transaction Reference: <strong>${data.reference}</strong></div>
    </div>

    <table style="width: 100%; border-collapse: collapse;">
      <tr>
        <td style="vertical-align: bottom;">
          <div style="font-size: 10px; color: #64748b;">${branding.footer_info}</div>
        </td>
        <td style="text-align: right; vertical-align: bottom; width: 220px;">
          <div style="border-bottom: 1.5px solid #0f172a; padding-bottom: 4px; margin-bottom: 4px; font-size: 12px; font-weight: 800;">${(branding as any).authorized_signatory || (branding as any).signatory_name || "Managing Director / Financial Officer"}</div>
          <div style="font-size: 10px; color: #475569;">Authorized Financial Officer</div>
        </td>
      </tr>
    </table>
  </div>
  `;

  await downloadHtmlAsPdf(htmlStr, `Refund_Voucher_${data.voucherNumber}.pdf`);
}

async function downloadHtmlAsPdf(htmlStr: string, fileName: string) {
  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.left = "-9999px";
  container.style.top = "0";
  container.style.width = "794px";
  container.style.backgroundColor = "#ffffff";

  container.innerHTML = htmlStr;
  document.body.appendChild(container);

  try {
    await new Promise((r) => setTimeout(r, 250));

    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: "#ffffff",
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
    pdf.save(fileName);
  } finally {
    document.body.removeChild(container);
  }
}
