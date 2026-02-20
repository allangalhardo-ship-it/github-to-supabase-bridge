import { useState, useCallback } from "react";
import { ShoppingCart } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrencyBRL } from "@/lib/format";
import { motion, AnimatePresence } from "framer-motion";
import { CarrinhoItem, Empresa } from "../types";
import { CheckoutStep, DadosEntrega, DadosPagamento, PedidoCriado, FORMAS_PAGAMENTO_LABELS } from "./types";
import { StepIndicator } from "./StepIndicator";
import { CartStep } from "./CartStep";
import { DeliveryStep } from "./DeliveryStep";
import { PaymentStep } from "./PaymentStep";
import { ConfirmationStep } from "./ConfirmationStep";
import { OrderSuccessStep } from "./OrderSuccessStep";

interface CheckoutDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  carrinho: CarrinhoItem[];
  empresa: Empresa;
  onAddItem: (carrinhoKey: string) => void;
  onRemoveItem: (carrinhoKey: string) => void;
  onDeleteItem: (carrinhoKey: string) => void;
  onPedidoEnviado: () => void;
}

export function CheckoutDrawer({
  open, onOpenChange, carrinho, empresa,
  onAddItem, onRemoveItem, onDeleteItem, onPedidoEnviado
}: CheckoutDrawerProps) {
  const [step, setStep] = useState<CheckoutStep | 'sucesso'>('carrinho');
  const [enviando, setEnviando] = useState(false);
  const [pedidoCriado, setPedidoCriado] = useState<PedidoCriado | null>(null);
  const [observacoes, setObservacoes] = useState("");

  const [entrega, setEntrega] = useState<DadosEntrega>({
    tipo: 'retirada', nome: '', whatsapp: '', endereco: ''
  });

  const [pagamento, setPagamento] = useState<DadosPagamento>({
    forma: 'pix'
  });

  const quantidadeTotal = carrinho.reduce((t, i) => t + i.quantidade, 0);
  const totalCarrinho = carrinho.reduce((total, item) => {
    const totalOpcionais = item.opcionais.reduce((sum, op) => sum + op.preco_adicional, 0);
    return total + (item.produto.preco_venda + totalOpcionais) * item.quantidade;
  }, 0);

  const handleConfirm = useCallback(async () => {
    setEnviando(true);
    try {
      const itensJson = carrinho.map((item) => ({
        produto_id: item.produto.id,
        nome: item.produto.nome,
        quantidade: item.quantidade,
        preco_unitario: item.produto.preco_venda,
        observacao: item.observacao,
        opcionais: item.opcionais.map(op => ({
          nome: op.item_nome,
          grupo: op.grupo_nome,
          preco: op.preco_adicional,
        })),
      }));

      const { data, error } = await supabase.from("pedidos").insert({
        empresa_id: empresa.id,
        itens: itensJson,
        valor_total: totalCarrinho,
        origem: "cardapio",
        status: "pendente",
        tipo_entrega: entrega.tipo,
        forma_pagamento: pagamento.forma,
        cliente_nome: entrega.nome,
        cliente_whatsapp: entrega.whatsapp,
        endereco_entrega: entrega.tipo === 'entrega' ? entrega.endereco : null,
        troco_para: pagamento.troco_para || null,
        observacoes: observacoes || null,
      }).select('id, numero_pedido').single();

      if (error) throw error;

      // Send WhatsApp notification to owner
      if (empresa.whatsapp_dono) {
        let mensagem = `🛒 *NOVO PEDIDO #${data.numero_pedido}*\n\n`;
        mensagem += `👤 ${entrega.nome}\n📱 ${entrega.whatsapp}\n`;
        mensagem += entrega.tipo === 'entrega' ? `📍 ${entrega.endereco}\n` : `🏪 Retirada no local\n`;
        mensagem += `💳 ${FORMAS_PAGAMENTO_LABELS[pagamento.forma]}`;
        if (pagamento.forma === 'dinheiro' && pagamento.troco_para) {
          mensagem += ` (troco p/ ${formatCurrencyBRL(pagamento.troco_para)})`;
        }
        mensagem += `\n\n📋 *ITENS:*\n`;
        carrinho.forEach((item) => {
          const totalOp = item.opcionais.reduce((s, o) => s + o.preco_adicional, 0);
          const precoItem = (item.produto.preco_venda + totalOp) * item.quantidade;
          mensagem += `• ${item.quantidade}x ${item.produto.nome} - ${formatCurrencyBRL(precoItem)}\n`;
          item.opcionais.forEach(op => {
            mensagem += `  ✓ ${op.item_nome}${op.preco_adicional > 0 ? ` (+${formatCurrencyBRL(op.preco_adicional)})` : ''}\n`;
          });
          if (item.observacao) mensagem += `  _Obs: ${item.observacao}_\n`;
        });
        mensagem += `\n💰 *TOTAL: ${formatCurrencyBRL(totalCarrinho)}*`;
        if (observacoes) mensagem += `\n📝 ${observacoes}`;

        const num = empresa.whatsapp_dono.replace(/\D/g, "");
        window.open(`https://wa.me/55${num}?text=${encodeURIComponent(mensagem)}`, "_blank");
      }

      setPedidoCriado({ id: data.id, numero_pedido: data.numero_pedido });
      setStep('sucesso');
      toast.success("Pedido enviado com sucesso!");
    } catch (error) {
      console.error("Erro ao enviar pedido:", error);
      toast.error("Erro ao enviar pedido. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  }, [carrinho, empresa, entrega, pagamento, totalCarrinho, observacoes]);

  const handleClose = () => {
    if (step === 'sucesso') {
      setStep('carrinho');
      setEntrega({ tipo: 'retirada', nome: '', whatsapp: '', endereco: '' });
      setPagamento({ forma: 'pix' });
      setObservacoes('');
      setPedidoCriado(null);
      onPedidoEnviado();
    }
    onOpenChange(false);
  };

  const trackingUrl = pedidoCriado ? `${window.location.origin}/pedido/${pedidoCriado.id}` : '';

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
        <SheetHeader className="px-5 py-4 border-b bg-white flex-shrink-0 space-y-3">
          <SheetTitle className="flex items-center gap-2 text-xl">
            <ShoppingCart className="h-6 w-6 text-emerald-600" />
            {step === 'sucesso' ? 'Pedido enviado' : 'Seu Pedido'}
            {step !== 'sucesso' && quantidadeTotal > 0 && (
              <span className="ml-auto bg-emerald-100 text-emerald-700 text-sm font-semibold px-2.5 py-0.5 rounded-full">
                {quantidadeTotal} {quantidadeTotal === 1 ? 'item' : 'itens'}
              </span>
            )}
          </SheetTitle>
          {step !== 'sucesso' && carrinho.length > 0 && (
            <StepIndicator currentStep={step as CheckoutStep} />
          )}
        </SheetHeader>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col flex-1 overflow-hidden"
          >
            {step === 'carrinho' && (
              <CartStep
                carrinho={carrinho}
                onAddItem={onAddItem}
                onRemoveItem={onRemoveItem}
                onDeleteItem={onDeleteItem}
                onNext={() => setStep('entrega')}
              />
            )}

            {step === 'entrega' && (
              <DeliveryStep
                dados={entrega}
                onChange={setEntrega}
                onNext={() => setStep('pagamento')}
                onBack={() => setStep('carrinho')}
              />
            )}

            {step === 'pagamento' && (
              <PaymentStep
                dados={pagamento}
                total={totalCarrinho}
                onChange={setPagamento}
                onNext={() => setStep('confirmacao')}
                onBack={() => setStep('entrega')}
              />
            )}

            {step === 'confirmacao' && (
              <ConfirmationStep
                carrinho={carrinho}
                entrega={entrega}
                pagamento={pagamento}
                observacoes={observacoes}
                onObservacoesChange={setObservacoes}
                onConfirm={handleConfirm}
                onBack={() => setStep('pagamento')}
                enviando={enviando}
              />
            )}

            {step === 'sucesso' && pedidoCriado && (
              <OrderSuccessStep
                pedido={pedidoCriado}
                onClose={handleClose}
                trackingUrl={trackingUrl}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </SheetContent>
    </Sheet>
  );
}
