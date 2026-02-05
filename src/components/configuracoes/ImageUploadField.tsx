import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Upload, X, ImageIcon, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ImageUploadFieldProps {
  label: string;
  description?: string;
  value: string | null;
  onChange: (url: string | null) => void;
  empresaId: string;
  folder: "logo" | "banner";
  aspectRatio?: string;
  previewHeight?: string;
}

export function ImageUploadField({
  label,
  description,
  value,
  onChange,
  empresaId,
  folder,
  aspectRatio = "aspect-video",
  previewHeight = "h-32",
}: ImageUploadFieldProps) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validar tipo de arquivo
    if (!file.type.startsWith("image/")) {
      toast.error("Por favor, selecione uma imagem");
      return;
    }

    // Validar tamanho (máx 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("A imagem deve ter no máximo 5MB");
      return;
    }

    setUploading(true);

    try {
      // Gerar nome único para o arquivo
      const fileExt = file.name.split(".").pop();
      const fileName = `${empresaId}/${folder}-${Date.now()}.${fileExt}`;

      // Remover imagem antiga se existir
      if (value) {
        const oldPath = value.split("/cardapio-images/")[1];
        if (oldPath) {
          await supabase.storage.from("cardapio-images").remove([oldPath]);
        }
      }

      // Upload da nova imagem
      const { error: uploadError } = await supabase.storage
        .from("cardapio-images")
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Obter URL pública
      const { data: { publicUrl } } = supabase.storage
        .from("cardapio-images")
        .getPublicUrl(fileName);

      onChange(publicUrl);
      toast.success("Imagem enviada com sucesso!");
    } catch (error: any) {
      console.error("Erro no upload:", error);
      toast.error("Erro ao enviar imagem: " + (error.message || "Tente novamente"));
    } finally {
      setUploading(false);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  };

  const handleRemove = async () => {
    if (!value) return;

    try {
      const oldPath = value.split("/cardapio-images/")[1];
      if (oldPath) {
        await supabase.storage.from("cardapio-images").remove([oldPath]);
      }
      onChange(null);
      toast.success("Imagem removida");
    } catch (error) {
      console.error("Erro ao remover:", error);
      toast.error("Erro ao remover imagem");
    }
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleUpload}
        className="hidden"
        disabled={uploading}
      />

      {value ? (
        <div className={cn("relative rounded-lg overflow-hidden border bg-muted", previewHeight)}>
          <img
            src={value}
            alt={label}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Trocar
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleRemove}
            >
              <X className="h-4 w-4" />
              Remover
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className={cn(
            "w-full rounded-lg border-2 border-dashed border-muted-foreground/25 bg-muted/50",
            "hover:border-primary/50 hover:bg-muted transition-colors",
            "flex flex-col items-center justify-center gap-2 cursor-pointer",
            previewHeight
          )}
        >
          {uploading ? (
            <Loader2 className="h-8 w-8 text-muted-foreground animate-spin" />
          ) : (
            <>
              <ImageIcon className="h-8 w-8 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Clique para enviar
              </span>
            </>
          )}
        </button>
      )}
    </div>
  );
}
