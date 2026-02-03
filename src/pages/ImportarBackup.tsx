import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Upload, Loader2, CheckCircle, AlertCircle } from "lucide-react";

interface ImportResult {
  success: boolean;
  message: string;
  details?: Record<string, { success: number; errors: string[] }>;
  error?: string;
}

export default function ImportarBackup() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (!selectedFile.name.endsWith('.json') && !selectedFile.name.endsWith('.txt')) {
        toast.error("Por favor, selecione um arquivo JSON ou TXT");
        return;
      }
      setFile(selectedFile);
      setResult(null);
    }
  };

  const handleImport = async () => {
    if (!file) {
      toast.error("Selecione um arquivo primeiro");
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const fileContent = await file.text();
      const backupData = JSON.parse(fileContent);

      const { data, error } = await supabase.functions.invoke("import-backup", {
        body: { data: backupData },
      });

      if (error) {
        throw new Error(error.message);
      }

      setResult(data as ImportResult);
      
      if (data.success) {
        toast.success(data.message);
      } else {
        toast.error(data.error || "Erro na importação");
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      toast.error(`Erro: ${errorMessage}`);
      setResult({
        success: false,
        message: "Falha na importação",
        error: errorMessage,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-6 w-6" />
            Importar Backup
          </CardTitle>
          <CardDescription>
            Selecione o arquivo JSON de backup para restaurar os dados
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Input
              type="file"
              accept=".json,.txt"
              onChange={handleFileChange}
              disabled={loading}
            />
            {file && (
              <p className="text-sm text-muted-foreground">
                Arquivo selecionado: <strong>{file.name}</strong> ({(file.size / 1024).toFixed(1)} KB)
              </p>
            )}
          </div>

          <Button
            onClick={handleImport}
            disabled={!file || loading}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Importando...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Iniciar Importação
              </>
            )}
          </Button>

          {result && (
            <Card className={result.success ? "border-green-500" : "border-red-500"}>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  {result.success ? (
                    <>
                      <CheckCircle className="h-5 w-5 text-green-500" />
                      Importação Concluída
                    </>
                  ) : (
                    <>
                      <AlertCircle className="h-5 w-5 text-red-500" />
                      Erro na Importação
                    </>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="mb-4">{result.message}</p>
                
                {result.details && (
                  <div className="space-y-2">
                    <h4 className="font-semibold">Detalhes por tabela:</h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                      {Object.entries(result.details).map(([table, info]) => (
                        <div
                          key={table}
                          className={`p-2 rounded ${
                            info.errors.length > 0
                              ? "bg-yellow-50 border border-yellow-200"
                              : "bg-green-50 border border-green-200"
                          }`}
                        >
                          <strong>{table}</strong>
                          <br />
                          ✅ {info.success} registros
                          {info.errors.length > 0 && (
                            <span className="text-red-600">
                              <br />⚠️ {info.errors.length} erros
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {result.error && (
                  <p className="text-red-600 mt-2">{result.error}</p>
                )}
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
