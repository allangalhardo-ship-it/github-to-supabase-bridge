import { useState } from "react";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { CarrinhoItem, Empresa } from "../types";
import { CheckoutData, CheckoutStep } from "./types";
import { StepIndicator } from "./StepIndicator";
import { CartStep } from "./CartStep";
import { IdentificacaoStep } from "./IdentificacaoStep";
import { EntregaStep } from "./EntregaStep";
import { PagamentoStep } from "./PagamentoStep";
import { ConfirmacaoStep } from "./ConfirmacaoStep";
import { OrderSuccessStep } from "./OrderSuccessStep";
import { motion, AnimatePresence } from "framer-motion";

interface CheckoutDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  carrinho: CarrinhoItem[];
  empresa: Empresa;
  onAddItem: (key: string) => void;
  onRemoveItem: (key: string) => void;
  onDeleteItem: (key: string) => void;
  onPedidoEnviado: () => void;
}

export function CheckoutDrawer({ open, onOpenChange, carrinho, empresa, onAddItem, onRemoveItem, onDeleteItem, onPedidoEnviado }: CheckoutDrawerProps) {
  const [step, setStep] = useState<CheckoutStep>("carrinho");
  const [successData, setSuccessData] = useState<{ pedidoId: string; numeroPedido: number } | null>(null);
  const [checkoutData, setCheckoutData] = useState<CheckoutData>({
    nome: "",
    whatsapp: "",
    tipo_entrega: "retirada",
    bairro_id: "",
    bairro_nome: "",
    taxa_entrega: 0,
    endereco: "",
    complemento: "",
    forma_pagamento: "",
    troco_para: null,
    observacoes: "",
  });

  const subtotal = carrinho.reduce((t, item) => {
    const opTotal = item.opcionais.reduce((s, o) => s + o.preco_adicional, 0);
    return t + (item.produto.preco_venda + opTotal) * item.quantidade;
  }, 0);

  const updateData = (partial: Partial<CheckoutData>) => {
    setCheckoutData(prev => ({ ...prev, ...partial }));
  };

  const handleSuccess = (pedidoId: string, numeroPedido: number) => {
    setSuccessData({ pedidoId, numeroPedido });
    onPedidoEnviado();
  };

  const handleClose = () => {
    onOpenChange(false);
    // Reset after animation
    setTimeout(() => {
      setStep("carrinho");
      setSuccessData(null);
      setCheckoutData({
        nome: "", whatsapp: "", tipo_entrega: "retirada",
        bairro_id: "", bairro_nome: "", taxa_entrega: 0,
        endereco: "", complemento: "", forma_pagamento: "",
        troco_para: null, observacoes: "",
      });
    }, 300);
  };

  return (
    <Drawer open={open} onOpenChange={(o) => !o ? handleClose() : onOpenChange(true)}>
      <DrawerContent className="max-h-[92vh] flex flex-col">
        {successData ? (
          <OrderSuccessStep pedidoId={successData.pedidoId} numeroPedido={successData.numeroPedido} />
        ) : (
          <>
            <div className="px-4 pt-2 border-b">
              <StepIndicator currentStep={step} />
            </div>
            <div className="flex-1 min-h-0 overflow-hidden">
              <AnimatePresence mode="wait">
                <motion.div
                  key={step}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                  className="h-full flex flex-col"
                >
                  {step === "carrinho" && (
                    <CartStep carrinho={carrinho} onAdd={onAddItem} onRemove={onRemoveItem} onDelete={onDeleteItem} onNext={() => setStep("identificacao")} />
                  )}
                  {step === "identificacao" && (
                    <IdentificacaoStep data={checkoutData} onChange={updateData} onNext={() => setStep("entrega")} onBack={() => setStep("carrinho")} />
                  )}
                  {step === "entrega" && (
                    <EntregaStep data={checkoutData} empresa={empresa} subtotal={subtotal} onChange={updateData} onNext={() => setStep("pagamento")} onBack={() => setStep("identificacao")} />
                  )}
                  {step === "pagamento" && (
                    <PagamentoStep data={checkoutData} empresa={empresa} subtotal={subtotal} onChange={updateData} onNext={() => setStep("confirmacao")} onBack={() => setStep("entrega")} />
                  )}
                  {step === "confirmacao" && (
                    <ConfirmacaoStep carrinho={carrinho} data={checkoutData} empresa={empresa} subtotal={subtotal} onBack={() => setStep("pagamento")} onSuccess={handleSuccess} />
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </>
        )}
      </DrawerContent>
    </Drawer>
  );
}
