/** Mensagens em português para os motivos de recusa de cartão do Mercado Pago. */
const MESSAGES: Record<string, string> = {
  cc_rejected_bad_filled_card_number: "Confira o número do cartão.",
  cc_rejected_bad_filled_date: "Confira a data de validade do cartão.",
  cc_rejected_bad_filled_other: "Confira os dados do cartão.",
  cc_rejected_bad_filled_security_code: "Confira o código de segurança (CVV).",
  cc_rejected_blacklist: "Pagamento recusado por segurança. Tente outro cartão ou pague com PIX.",
  cc_rejected_high_risk: "Pagamento recusado por segurança. Tente outro cartão ou pague com PIX.",
  cc_rejected_call_for_authorize: "Seu banco precisa autorizar este pagamento. Fale com o banco e tente novamente.",
  cc_rejected_card_disabled: "Cartão inativo. Ative-o com seu banco ou use outro cartão.",
  cc_rejected_duplicated_payment: "Já existe um pagamento igual. Use outro cartão ou pague com PIX.",
  cc_rejected_insufficient_amount: "Limite insuficiente. Tente outro cartão ou pague com PIX.",
  cc_rejected_max_attempts: "Limite de tentativas atingido. Use outro cartão ou pague com PIX.",
  cc_rejected_invalid_installments: "Este cartão não aceita esse número de parcelas.",
  cc_rejected_card_error: "Não foi possível processar o cartão. Tente outro cartão ou pague com PIX.",
};

export function rejectionMessage(statusDetail: string | null | undefined): string {
  return (statusDetail && MESSAGES[statusDetail]) || "Pagamento recusado. Tente outro cartão ou pague com PIX.";
}
