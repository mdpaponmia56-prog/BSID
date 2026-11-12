export type BloodGroup =
  | "A+"
  | "A-"
  | "B+"
  | "B-"
  | "AB+"
  | "AB-"
  | "O+"
  | "O-";

export const BLOOD_GROUPS: BloodGroup[] = [
  "A+",
  "A-",
  "B+",
  "B-",
  "AB+",
  "AB-",
  "O+",
  "O-",
];

export type ApplicationStatus = "Pending" | "Approved" | "Rejected";

export interface TextFieldConfig {
  key:
    | "full_name"
    | "bs_id"
    | "blood_group"
    | "father_name"
    | "mother_name"
    | "contact_number"
    | "email"
    | "present_address";
  label: string;
  side: "front" | "back";
  x: number;
  y: number;
  maxWidth: number;
  align: "left" | "center" | "right";
  fontFamily: string;
  fontSize: number;
  fontWeight: "400" | "500" | "600" | "700";
  color: string;
  lineHeight: number;
  wrap: boolean;
}

export interface ImageFieldConfig {
  photograph: {
    side: "front" | "back";
    x: number;
    y: number;
    width: number;
    height: number;
    borderRadius: number;
    objectFit: "cover" | "contain" | "fill";
    cropX: number;
    cropY: number;
    zoom: number;
  };
  qrCode: {
    side: "front" | "back";
    enabled: boolean;
    x: number;
    y: number;
    width: number;
    height: number;
    showCenterSeal: boolean;
  };
}

export interface TypographyConfiguration {
  availableFonts: string[];
  renderScale: number;
  qrMode: "dynamic_bs_id" | "verification_json";
}

export interface IdCardTemplateRecord {
  id: string;
  template_name: string;
  front_background_url: string;
  back_background_url: string;
  front_background_file_id: string | null;
  back_background_file_id: string | null;
  card_width: number;
  card_height: number;
  text_position_configuration: Record<TextFieldConfig["key"], TextFieldConfig>;
  image_position_configuration: ImageFieldConfig;
  typography_configuration: TypographyConfiguration;
  template_status: "Active" | "Archived" | "Draft";
  version_number: number;
  created_date: string;
  updated_date: string;
}

export interface TemplateVersionRecord {
  id: string;
  template_id: string;
  version_number: number;
  template_name: string;
  front_background_url: string;
  back_background_url: string;
  front_background_file_id: string | null;
  back_background_file_id: string | null;
  card_width: number;
  card_height: number;
  text_position_configuration: Record<TextFieldConfig["key"], TextFieldConfig>;
  image_position_configuration: ImageFieldConfig;
  typography_configuration: TypographyConfiguration;
  saved_by_email: string;
  created_date: string;
}

export interface ApplicationRecord {
  id: string;
  application_reference: string;
  full_name: string;
  bs_id: string;
  blood_group: BloodGroup;
  photograph_url: string;
  photograph_file_id: string | null;
  father_name: string;
  mother_name: string;
  contact_number: string;
  email: string;
  present_address: string;
  application_status: ApplicationStatus;
  generated_card_front_url: string | null;
  generated_card_back_url: string | null;
  generated_card_front_file_id: string | null;
  generated_card_back_file_id: string | null;
  generated_card_pdf_url: string | null;
  generated_card_pdf_file_id: string | null;
  template_id: string | null;
  submission_date: string;
  updated_date: string;
  approved_date: string | null;
  rejection_reason: string | null;
}

export interface AuditLogRecord {
  id: string;
  administrator_id: string | null;
  administrator_email: string;
  application_id: string | null;
  action_type: string;
  previous_values: Record<string, unknown> | null;
  updated_values: Record<string, unknown> | null;
  timestamp: string;
}

export const DEFAULT_TEXT_POSITION_CONFIG: Record<
  TextFieldConfig["key"],
  TextFieldConfig
> = {
  full_name: {
    key: "full_name",
    label: "Full Name",
    side: "front",
    x: 295,
    y: 621,
    maxWidth: 490,
    align: "center",
    fontFamily: "Open Sans",
    fontSize: 43,
    fontWeight: "600",
    color: "#111111",
    lineHeight: 1.15,
    wrap: true,
  },
  bs_id: {
    key: "bs_id",
    label: "BS ID",
    side: "front",
    x: 430,
    y: 506,
    maxWidth: 146,
    align: "center",
    fontFamily: "Merriweather",
    fontSize: 27,
    fontWeight: "700",
    color: "#FFFFFF",
    lineHeight: 1.1,
    wrap: false,
  },
  blood_group: {
    key: "blood_group",
    label: "Blood Group",
    side: "front",
    x: 428,
    y: 403,
    maxWidth: 48,
    align: "center",
    fontFamily: "Merriweather",
    fontSize: 26,
    fontWeight: "700",
    color: "#FFFFFF",
    lineHeight: 1.0,
    wrap: false,
  },
  father_name: {
    key: "father_name",
    label: "Father's Name",
    side: "back",
    x: 107,
    y: 242,
    maxWidth: 228,
    align: "left",
    fontFamily: "Open Sans",
    fontSize: 22,
    fontWeight: "400",
    color: "#111111",
    lineHeight: 1.2,
    wrap: true,
  },
  mother_name: {
    key: "mother_name",
    label: "Mother's Name",
    side: "back",
    x: 107,
    y: 350,
    maxWidth: 228,
    align: "left",
    fontFamily: "Open Sans",
    fontSize: 22,
    fontWeight: "400",
    color: "#111111",
    lineHeight: 1.2,
    wrap: true,
  },
  contact_number: {
    key: "contact_number",
    label: "Contact Number",
    side: "back",
    x: 107,
    y: 453,
    maxWidth: 228,
    align: "left",
    fontFamily: "Open Sans",
    fontSize: 22,
    fontWeight: "400",
    color: "#111111",
    lineHeight: 1.2,
    wrap: false,
  },
  email: {
    key: "email",
    label: "Email Address",
    side: "back",
    x: 103,
    y: 527,
    maxWidth: 452,
    align: "left",
    fontFamily: "Open Sans",
    fontSize: 24,
    fontWeight: "400",
    color: "#111111",
    lineHeight: 1.15,
    wrap: true,
  },
  present_address: {
    key: "present_address",
    label: "Present Address",
    side: "back",
    x: 104,
    y: 696,
    maxWidth: 440,
    align: "left",
    fontFamily: "Open Sans",
    fontSize: 24,
    fontWeight: "400",
    color: "#111111",
    lineHeight: 1.22,
    wrap: true,
  },
};

export const DEFAULT_IMAGE_POSITION_CONFIG: ImageFieldConfig = {
  photograph: {
    side: "front",
    x: 53,
    y: 238,
    width: 252,
    height: 314,
    borderRadius: 24,
    objectFit: "cover",
    cropX: 0.5,
    cropY: 0.5,
    zoom: 1,
  },
  qrCode: {
    side: "back",
    enabled: true,
    x: 382,
    y: 220,
    width: 174,
    height: 174,
    showCenterSeal: true,
  },
};

export const DEFAULT_TYPOGRAPHY_CONFIG: TypographyConfiguration = {
  availableFonts: ["Open Sans", "Merriweather"],
  renderScale: 3,
  qrMode: "dynamic_bs_id",
};
