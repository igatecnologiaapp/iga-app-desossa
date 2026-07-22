export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      cortes: {
        Row: {
          active: boolean
          category_id: string | null
          code: string | null
          created_at: string
          id: string
          name: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          category_id?: string | null
          code?: string | null
          created_at?: string
          id?: string
          name: string
          tenant_id?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          category_id?: string | null
          code?: string | null
          created_at?: string
          id?: string
          name?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cortes_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cortes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      deboning_losses: {
        Row: {
          descarte: number
          gordura: number
          id: string
          is_demo: boolean
          observacoes: string | null
          order_id: string
          ossos: number
          outros: number
          retalhos: number
          updated_at: string
        }
        Insert: {
          descarte?: number
          gordura?: number
          id?: string
          is_demo?: boolean
          observacoes?: string | null
          order_id: string
          ossos?: number
          outros?: number
          retalhos?: number
          updated_at?: string
        }
        Update: {
          descarte?: number
          gordura?: number
          id?: string
          is_demo?: boolean
          observacoes?: string | null
          order_id?: string
          ossos?: number
          outros?: number
          retalhos?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deboning_losses_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "deboning_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      deboning_order_history: {
        Row: {
          action: string
          created_at: string
          field: string | null
          from_status: string | null
          id: string
          is_demo: boolean
          metadata: Json | null
          new_value: string | null
          notes: string | null
          old_value: string | null
          order_id: string
          tenant_id: string
          to_status: string | null
          user_id: string | null
          user_name: string | null
        }
        Insert: {
          action: string
          created_at?: string
          field?: string | null
          from_status?: string | null
          id?: string
          is_demo?: boolean
          metadata?: Json | null
          new_value?: string | null
          notes?: string | null
          old_value?: string | null
          order_id: string
          tenant_id?: string
          to_status?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          field?: string | null
          from_status?: string | null
          id?: string
          is_demo?: boolean
          metadata?: Json | null
          new_value?: string | null
          notes?: string | null
          old_value?: string | null
          order_id?: string
          tenant_id?: string
          to_status?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deboning_order_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "deboning_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deboning_order_history_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      deboning_orders: {
        Row: {
          assigned_employee_id: string | null
          cancellation_reason: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          deletion_reason: string | null
          divergencia_kg: number | null
          divergencia_pct: number | null
          finalizada_com_divergencia: boolean
          finished_at: string | null
          id: string
          is_demo: boolean
          margem_pct: number | null
          observacoes: string | null
          observacoes_finalizacao: string | null
          order_code: string | null
          order_date: string
          peca_entrada_id: string | null
          peso_aproveitado: number | null
          peso_inicial: number
          product_id: string | null
          rendimento_pct: number | null
          reopen_count: number
          reopen_reason: string | null
          reopened_at: string | null
          reopened_by: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["order_status"]
          stock_entry_id: string | null
          supplier_id: string | null
          tenant_id: string
          valor_compra: number | null
        }
        Insert: {
          assigned_employee_id?: string | null
          cancellation_reason?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          deletion_reason?: string | null
          divergencia_kg?: number | null
          divergencia_pct?: number | null
          finalizada_com_divergencia?: boolean
          finished_at?: string | null
          id?: string
          is_demo?: boolean
          margem_pct?: number | null
          observacoes?: string | null
          observacoes_finalizacao?: string | null
          order_code?: string | null
          order_date?: string
          peca_entrada_id?: string | null
          peso_aproveitado?: number | null
          peso_inicial: number
          product_id?: string | null
          rendimento_pct?: number | null
          reopen_count?: number
          reopen_reason?: string | null
          reopened_at?: string | null
          reopened_by?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          stock_entry_id?: string | null
          supplier_id?: string | null
          tenant_id?: string
          valor_compra?: number | null
        }
        Update: {
          assigned_employee_id?: string | null
          cancellation_reason?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          deletion_reason?: string | null
          divergencia_kg?: number | null
          divergencia_pct?: number | null
          finalizada_com_divergencia?: boolean
          finished_at?: string | null
          id?: string
          is_demo?: boolean
          margem_pct?: number | null
          observacoes?: string | null
          observacoes_finalizacao?: string | null
          order_code?: string | null
          order_date?: string
          peca_entrada_id?: string | null
          peso_aproveitado?: number | null
          peso_inicial?: number
          product_id?: string | null
          rendimento_pct?: number | null
          reopen_count?: number
          reopen_reason?: string | null
          reopened_at?: string | null
          reopened_by?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          stock_entry_id?: string | null
          supplier_id?: string | null
          tenant_id?: string
          valor_compra?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "deboning_orders_assigned_employee_id_fkey"
            columns: ["assigned_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deboning_orders_peca_entrada_id_fkey"
            columns: ["peca_entrada_id"]
            isOneToOne: false
            referencedRelation: "pecas_entrada"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deboning_orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deboning_orders_stock_entry_id_fkey"
            columns: ["stock_entry_id"]
            isOneToOne: false
            referencedRelation: "stock_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deboning_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deboning_orders_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      deboning_pieces: {
        Row: {
          corte_id: string | null
          created_at: string
          id: string
          is_demo: boolean
          observacoes: string | null
          order_id: string
          peso: number
          product_id: string | null
          quantidade: number
        }
        Insert: {
          corte_id?: string | null
          created_at?: string
          id?: string
          is_demo?: boolean
          observacoes?: string | null
          order_id: string
          peso: number
          product_id?: string | null
          quantidade?: number
        }
        Update: {
          corte_id?: string | null
          created_at?: string
          id?: string
          is_demo?: boolean
          observacoes?: string | null
          order_id?: string
          peso?: number
          product_id?: string | null
          quantidade?: number
        }
        Relationships: [
          {
            foreignKeyName: "deboning_pieces_corte_id_fkey"
            columns: ["corte_id"]
            isOneToOne: false
            referencedRelation: "cortes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deboning_pieces_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "deboning_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deboning_pieces_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          cargo: string | null
          cpf: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          is_demo: boolean
          status: string
          tenant_id: string
          user_id: string | null
        }
        Insert: {
          cargo?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          is_demo?: boolean
          status?: string
          tenant_id?: string
          user_id?: string | null
        }
        Update: {
          cargo?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          is_demo?: boolean
          status?: string
          tenant_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          is_demo: boolean
          order_id: string | null
          read_at: string | null
          tenant_id: string
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          is_demo?: boolean
          order_id?: string | null
          read_at?: string | null
          tenant_id?: string
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          is_demo?: boolean
          order_id?: string | null
          read_at?: string | null
          tenant_id?: string
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "deboning_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      order_code_counters: {
        Row: {
          last_value: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          last_value?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          last_value?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_code_counters_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      peca_cortes: {
        Row: {
          corte_id: string
          created_at: string
          id: string
          peca_id: string
          rendimento_esperado_pct: number | null
          tenant_id: string
        }
        Insert: {
          corte_id: string
          created_at?: string
          id?: string
          peca_id: string
          rendimento_esperado_pct?: number | null
          tenant_id?: string
        }
        Update: {
          corte_id?: string
          created_at?: string
          id?: string
          peca_id?: string
          rendimento_esperado_pct?: number | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "peca_cortes_corte_id_fkey"
            columns: ["corte_id"]
            isOneToOne: false
            referencedRelation: "cortes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "peca_cortes_peca_id_fkey"
            columns: ["peca_id"]
            isOneToOne: false
            referencedRelation: "pecas_entrada"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "peca_cortes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      pecas_entrada: {
        Row: {
          active: boolean
          category_id: string | null
          code: string | null
          created_at: string
          id: string
          name: string
          observacoes: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          category_id?: string | null
          code?: string | null
          created_at?: string
          id?: string
          name: string
          observacoes?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          category_id?: string | null
          code?: string | null
          created_at?: string
          id?: string
          name?: string
          observacoes?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pecas_entrada_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pecas_entrada_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_categories: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
          tenant_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_categories_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category_id: string | null
          code: string | null
          created_at: string
          id: string
          name: string
          observacoes: string | null
          peso_medio: number | null
          tenant_id: string
          unit: string
        }
        Insert: {
          category_id?: string | null
          code?: string | null
          created_at?: string
          id?: string
          name: string
          observacoes?: string | null
          peso_medio?: number | null
          tenant_id?: string
          unit?: string
        }
        Update: {
          category_id?: string | null
          code?: string | null
          created_at?: string
          id?: string
          name?: string
          observacoes?: string | null
          peso_medio?: number | null
          tenant_id?: string
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          cpf: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          cpf?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Update: {
          cpf?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_entries: {
        Row: {
          created_at: string
          entry_date: string
          id: string
          invoice_number: string | null
          is_demo: boolean
          lote: string | null
          observacoes: string | null
          peca_entrada_id: string | null
          peso_bruto: number
          product_id: string | null
          purchase_value: number | null
          supplier_id: string | null
          tenant_id: string
        }
        Insert: {
          created_at?: string
          entry_date?: string
          id?: string
          invoice_number?: string | null
          is_demo?: boolean
          lote?: string | null
          observacoes?: string | null
          peca_entrada_id?: string | null
          peso_bruto: number
          product_id?: string | null
          purchase_value?: number | null
          supplier_id?: string | null
          tenant_id?: string
        }
        Update: {
          created_at?: string
          entry_date?: string
          id?: string
          invoice_number?: string | null
          is_demo?: boolean
          lote?: string | null
          observacoes?: string | null
          peca_entrada_id?: string | null
          peso_bruto?: number
          product_id?: string | null
          purchase_value?: number | null
          supplier_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_entries_peca_entrada_id_fkey"
            columns: ["peca_entrada_id"]
            isOneToOne: false
            referencedRelation: "pecas_entrada"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_entries_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_entries_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_entries_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          cnpj: string | null
          contato: string | null
          created_at: string
          email: string | null
          id: string
          is_demo: boolean
          nome_fantasia: string | null
          observacoes: string | null
          razao_social: string
          telefone: string | null
          tenant_id: string
        }
        Insert: {
          cnpj?: string | null
          contato?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_demo?: boolean
          nome_fantasia?: string | null
          observacoes?: string | null
          razao_social: string
          telefone?: string | null
          tenant_id?: string
        }
        Update: {
          cnpj?: string | null
          contato?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_demo?: boolean
          nome_fantasia?: string | null
          observacoes?: string | null
          razao_social?: string
          telefone?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_settings: {
        Row: {
          atencao_pct: number
          critico_pct: number
          divergencia_maxima_kg: number
          margem_padrao_pct: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          atencao_pct?: number
          critico_pct?: number
          divergencia_maxima_kg?: number
          margem_padrao_pct?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          atencao_pct?: number
          critico_pct?: number
          divergencia_maxima_kg?: number
          margem_padrao_pct?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          tenant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          tenant_id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_tenant: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      next_order_code: { Args: { _tenant: string }; Returns: string }
    }
    Enums: {
      app_role: "admin" | "acougueiro" | "supervisor" | "visualizacao"
      order_status:
        | "pendente"
        | "em_andamento"
        | "finalizada"
        | "atribuida"
        | "aguardando_conferencia"
        | "cancelada"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "acougueiro", "supervisor", "visualizacao"],
      order_status: [
        "pendente",
        "em_andamento",
        "finalizada",
        "atribuida",
        "aguardando_conferencia",
        "cancelada",
      ],
    },
  },
} as const
