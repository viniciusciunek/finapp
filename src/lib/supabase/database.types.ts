
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "accounts": {
                  Row: {
                    "balance_as_of": string | null,"balance_cents": number | null,"bank": string | null,"created_at": string,"created_by": string | null,"household_id": string | null,"id": string,"name": string,"owner_user_id": string | null,"scope": string,"type": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "balance_as_of"?: string | null,"balance_cents"?: number | null,"bank"?: string | null,"created_at"?: string,"created_by"?: string | null,"household_id"?: string | null,"id"?: string,"name": string,"owner_user_id"?: string | null,"scope"?: string,"type"?: string,"updated_at"?: string
                  }
                  Update: {
                    "balance_as_of"?: string | null,"balance_cents"?: number | null,"bank"?: string | null,"created_at"?: string,"created_by"?: string | null,"household_id"?: string | null,"id"?: string,"name"?: string,"owner_user_id"?: string | null,"scope"?: string,"type"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "accounts_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    }
                  ]
                },"card_installments": {
                  Row: {
                    "amount_cents": number,"created_at": string,"created_by": string | null,"household_id": string | null,"id": string,"number": number,"owner_user_id": string | null,"scope": string,"statement_id": string,"transaction_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_cents": number,"created_at"?: string,"created_by"?: string | null,"household_id"?: string | null,"id"?: string,"number": number,"owner_user_id"?: string | null,"scope"?: string,"statement_id": string,"transaction_id": string,"updated_at"?: string
                  }
                  Update: {
                    "amount_cents"?: number,"created_at"?: string,"created_by"?: string | null,"household_id"?: string | null,"id"?: string,"number"?: number,"owner_user_id"?: string | null,"scope"?: string,"statement_id"?: string,"transaction_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "card_installments_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "card_installments_statement_id_fkey"
      columns: ["statement_id"]
isOneToOne: false
      referencedRelation: "statements"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "card_installments_transaction_id_fkey"
      columns: ["transaction_id"]
isOneToOne: false
      referencedRelation: "transactions"
      referencedColumns: ["id"]
    }
                  ]
                },"categories": {
                  Row: {
                    "created_at": string,"created_by": string | null,"household_id": string | null,"id": string,"name": string,"owner_user_id": string | null,"scope": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"household_id"?: string | null,"id"?: string,"name": string,"owner_user_id"?: string | null,"scope"?: string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"household_id"?: string | null,"id"?: string,"name"?: string,"owner_user_id"?: string | null,"scope"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "categories_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    }
                  ]
                },"credit_cards": {
                  Row: {
                    "closing_day": number,"created_at": string,"created_by": string | null,"due_day": number,"household_id": string | null,"id": string,"limit_cents": number | null,"name": string,"owner_user_id": string | null,"scope": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "closing_day": number,"created_at"?: string,"created_by"?: string | null,"due_day": number,"household_id"?: string | null,"id"?: string,"limit_cents"?: number | null,"name": string,"owner_user_id"?: string | null,"scope"?: string,"updated_at"?: string
                  }
                  Update: {
                    "closing_day"?: number,"created_at"?: string,"created_by"?: string | null,"due_day"?: number,"household_id"?: string | null,"id"?: string,"limit_cents"?: number | null,"name"?: string,"owner_user_id"?: string | null,"scope"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "credit_cards_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    }
                  ]
                },"household_invites": {
                  Row: {
                    "accepted_at": string | null,"accepted_by": string | null,"code": string,"created_at": string,"created_by": string,"expires_at": string,"household_id": string,"id": string,"role": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "accepted_at"?: string | null,"accepted_by"?: string | null,"code": string,"created_at"?: string,"created_by": string,"expires_at"?: string,"household_id": string,"id"?: string,"role"?: string,"updated_at"?: string
                  }
                  Update: {
                    "accepted_at"?: string | null,"accepted_by"?: string | null,"code"?: string,"created_at"?: string,"created_by"?: string,"expires_at"?: string,"household_id"?: string,"id"?: string,"role"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "household_invites_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    }
                  ]
                },"household_members": {
                  Row: {
                    "created_at": string,"created_by": string,"household_id": string,"id": string,"role": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by": string,"household_id": string,"id"?: string,"role"?: string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string,"household_id"?: string,"id"?: string,"role"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "household_members_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    }
                  ]
                },"households": {
                  Row: {
                    "created_at": string,"created_by": string,"id": string,"name": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by": string,"id"?: string,"name": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string,"id"?: string,"name"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"month_sheets": {
                  Row: {
                    "created_at": string,"created_by": string | null,"household_id": string | null,"id": string,"owner_user_id": string | null,"planned_close_date": string,"reference_month": string,"scope": string,"status": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"household_id"?: string | null,"id"?: string,"owner_user_id"?: string | null,"planned_close_date": string,"reference_month": string,"scope"?: string,"status"?: string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"household_id"?: string | null,"id"?: string,"owner_user_id"?: string | null,"planned_close_date"?: string,"reference_month"?: string,"scope"?: string,"status"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "month_sheets_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"created_by": string,"email": string,"id": string,"name": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by": string,"email"?: string,"id": string,"name": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string,"email"?: string,"id"?: string,"name"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"recurring_templates": {
                  Row: {
                    "active": boolean,"category_id": string | null,"created_at": string,"created_by": string | null,"default_amount_cents": number,"due_day": number,"frequency": string,"household_id": string | null,"id": string,"name": string,"owner_user_id": string | null,"payer_user_id": string | null,"scope": string,"updated_at": string,"yearly_month": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"category_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"default_amount_cents": number,"due_day": number,"frequency"?: string,"household_id"?: string | null,"id"?: string,"name": string,"owner_user_id"?: string | null,"payer_user_id"?: string | null,"scope"?: string,"updated_at"?: string,"yearly_month"?: number | null
                  }
                  Update: {
                    "active"?: boolean,"category_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"default_amount_cents"?: number,"due_day"?: number,"frequency"?: string,"household_id"?: string | null,"id"?: string,"name"?: string,"owner_user_id"?: string | null,"payer_user_id"?: string | null,"scope"?: string,"updated_at"?: string,"yearly_month"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "recurring_templates_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "recurring_templates_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    }
                  ]
                },"sheet_items": {
                  Row: {
                    "actual_cents": number | null,"carried_from_item_id": string | null,"created_at": string,"created_by": string | null,"due_date": string | null,"expected_cents": number,"household_id": string | null,"id": string,"name": string,"owner_user_id": string | null,"paid_at": string | null,"paid_cents": number,"paid_from_account_id": string | null,"payer_user_id": string | null,"scope": string,"sheet_id": string,"source": string,"statement_id": string | null,"template_id": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "actual_cents"?: number | null,"carried_from_item_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"due_date"?: string | null,"expected_cents": number,"household_id"?: string | null,"id"?: string,"name": string,"owner_user_id"?: string | null,"paid_at"?: string | null,"paid_cents"?: number,"paid_from_account_id"?: string | null,"payer_user_id"?: string | null,"scope"?: string,"sheet_id": string,"source": string,"statement_id"?: string | null,"template_id"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "actual_cents"?: number | null,"carried_from_item_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"due_date"?: string | null,"expected_cents"?: number,"household_id"?: string | null,"id"?: string,"name"?: string,"owner_user_id"?: string | null,"paid_at"?: string | null,"paid_cents"?: number,"paid_from_account_id"?: string | null,"payer_user_id"?: string | null,"scope"?: string,"sheet_id"?: string,"source"?: string,"statement_id"?: string | null,"template_id"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "sheet_items_carried_from_item_id_fkey"
      columns: ["carried_from_item_id"]
isOneToOne: false
      referencedRelation: "sheet_items"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sheet_items_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sheet_items_paid_from_account_id_fkey"
      columns: ["paid_from_account_id"]
isOneToOne: false
      referencedRelation: "accounts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sheet_items_sheet_id_fkey"
      columns: ["sheet_id"]
isOneToOne: false
      referencedRelation: "month_sheets"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sheet_items_statement_id_fkey"
      columns: ["statement_id"]
isOneToOne: false
      referencedRelation: "statements"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sheet_items_template_id_fkey"
      columns: ["template_id"]
isOneToOne: false
      referencedRelation: "recurring_templates"
      referencedColumns: ["id"]
    }
                  ]
                },"statements": {
                  Row: {
                    "actual_cents": number | null,"card_id": string,"closing_date": string,"created_at": string,"created_by": string | null,"due_date": string,"household_id": string | null,"id": string,"owner_user_id": string | null,"paid_at": string | null,"paid_cents": number,"paid_from_account_id": string | null,"reference_month": string,"scope": string,"status": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "actual_cents"?: number | null,"card_id": string,"closing_date": string,"created_at"?: string,"created_by"?: string | null,"due_date": string,"household_id"?: string | null,"id"?: string,"owner_user_id"?: string | null,"paid_at"?: string | null,"paid_cents"?: number,"paid_from_account_id"?: string | null,"reference_month": string,"scope"?: string,"status"?: string,"updated_at"?: string
                  }
                  Update: {
                    "actual_cents"?: number | null,"card_id"?: string,"closing_date"?: string,"created_at"?: string,"created_by"?: string | null,"due_date"?: string,"household_id"?: string | null,"id"?: string,"owner_user_id"?: string | null,"paid_at"?: string | null,"paid_cents"?: number,"paid_from_account_id"?: string | null,"reference_month"?: string,"scope"?: string,"status"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "statements_card_id_fkey"
      columns: ["card_id"]
isOneToOne: false
      referencedRelation: "credit_cards"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "statements_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "statements_paid_from_account_id_fkey"
      columns: ["paid_from_account_id"]
isOneToOne: false
      referencedRelation: "accounts"
      referencedColumns: ["id"]
    }
                  ]
                },"transactions": {
                  Row: {
                    "account_id": string | null,"card_id": string | null,"category_id": string | null,"created_at": string,"created_by": string | null,"description": string,"household_id": string | null,"id": string,"installments_count": number,"notes": string | null,"occurred_on": string,"owner_user_id": string | null,"payment_method": string,"scope": string,"total_cents": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "account_id"?: string | null,"card_id"?: string | null,"category_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"description": string,"household_id"?: string | null,"id"?: string,"installments_count"?: number,"notes"?: string | null,"occurred_on": string,"owner_user_id"?: string | null,"payment_method": string,"scope"?: string,"total_cents": number,"updated_at"?: string
                  }
                  Update: {
                    "account_id"?: string | null,"card_id"?: string | null,"category_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"description"?: string,"household_id"?: string | null,"id"?: string,"installments_count"?: number,"notes"?: string | null,"occurred_on"?: string,"owner_user_id"?: string | null,"payment_method"?: string,"scope"?: string,"total_cents"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "transactions_account_id_fkey"
      columns: ["account_id"]
isOneToOne: false
      referencedRelation: "accounts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "transactions_card_id_fkey"
      columns: ["card_id"]
isOneToOne: false
      referencedRelation: "credit_cards"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "transactions_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "transactions_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    }
                  ]
                },"user_settings": {
                  Row: {
                    "created_at": string,"created_by": string,"payday_business_day": number,"payday_rule": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by": string,"payday_business_day"?: number,"payday_rule"?: string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string,"payday_business_day"?: number,"payday_rule"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "accept_household_invite":
{ Args: { "invite_code": string }; Returns: string
                           },
"create_household":
{ Args: { "household_name": string }; Returns: string
                           },
"is_household_member":
{ Args: { "target_household_id": string }; Returns: boolean
                           },
"is_household_owner":
{ Args: { "target_household_id": string }; Returns: boolean
                           },
"leave_household":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"shares_household_with":
{ Args: { "target_user_id": string }; Returns: boolean
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            
          }
        }
} as const
