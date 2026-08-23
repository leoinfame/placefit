import { useState, useEffect } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, CardElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Lock } from "lucide-react";

const cardOptions = {
  style: {
    base: {
      fontSize: "16px",
      color: "#0f172a",
      "::placeholder": { color: "#94a3b8" },
    },
    invalid: {
      color: "#dc2626",
    },
  },
};

function CheckoutForm({ clientSecret, customerId, onSuccess, onCancel }) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [holderName, setHolderName] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setLoading(true);
    setError("");

    const result = await stripe.confirmCardSetup(clientSecret, {
      payment_method: {
        card: elements.getElement(CardElement),
        billing_details: { name: holderName },
      },
    });

    if (result.error) {
      setError(result.error.message);
      setLoading(false);
    } else {
      try {
        const resp = await base44.functions.invoke("savePaymentMethod", {
          setup_intent_id: result.setupIntent.id,
          customer_id: customerId,
          holder_name: holderName,
        });
        onSuccess(resp);
      } catch (err) {
        setError(err.message || "Erro ao salvar cartão");
        setLoading(false);
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="holder-name">Nome impresso no cartão</Label>
        <Input
          id="holder-name"
          value={holderName}
          onChange={(e) => setHolderName(e.target.value)}
          placeholder="Como está no cartão"
          required
        />
      </div>
      <div>
        <Label>Dados do cartão</Label>
        <div className="p-3 border rounded-lg bg-white">
          <CardElement options={cardOptions} />
        </div>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <Lock className="w-3 h-3" />
        Criptografado via Stripe — não armazenamos os dados do cartão.
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={!stripe || loading} className="flex-1">
          {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
          Salvar cartão
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

export default function CardSetupForm({ onSuccess, onCancel }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [setupData, setSetupData] = useState(null);

  useEffect(() => {
    base44.functions
      .invoke("setupPaymentMethod", {})
      .then((resp) => {
        setSetupData(resp);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || "Erro ao iniciar");
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-red-600">{error}</p>;
  }

  if (!setupData) return null;

  const stripePromise = loadStripe(setupData.publishable_key);

  return (
    <Elements stripe={stripePromise} options={{ clientSecret: setupData.client_secret }}>
      <CheckoutForm
        clientSecret={setupData.client_secret}
        customerId={setupData.customer_id}
        onSuccess={onSuccess}
        onCancel={onCancel}
      />
    </Elements>
  );
}