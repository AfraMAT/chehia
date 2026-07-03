import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Conditions d’utilisation — Chehia",
  description: "Conditions d’utilisation de Chehia.",
};

/** Terms of service (FR — primary market). */
export default function TermsPage() {
  return (
    <article className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="font-display font-extrabold text-3xl text-ink">Conditions d’utilisation</h1>
        <p className="text-[13px] text-muted-soft">Dernière mise à jour : juillet 2026</p>
      </header>

      <p className="text-[15px] text-muted leading-relaxed">
        Chehia est édité par AfraMAT. En utilisant le service, vous acceptez les conditions ci-dessous.
      </p>

      <Section title="Le service">
        <p>
          Chehia permet aux clients de consulter le menu et de passer commande depuis leur table via un QR
          code, et aux établissements de gérer leur menu, leurs tables et leurs commandes en temps réel.
          Le <b>paiement s’effectue au comptoir</b> : Chehia ne traite aucun paiement.
        </p>
      </Section>

      <Section title="Commandes">
        <p>
          Une commande passée via Chehia est transmise à l’établissement pour préparation. Les prix affichés
          sont ceux définis par l’établissement ; ils sont recalculés côté serveur au moment de la commande.
          L’établissement reste responsable de la préparation, de la disponibilité des articles et du service.
        </p>
      </Section>

      <Section title="Usage acceptable">
        <p>
          Vous vous engagez à ne pas utiliser le service de manière abusive : commandes ou demandes
          frauduleuses, tentatives d’accès non autorisé, ou toute action perturbant le service. Nous pouvons
          limiter ou suspendre un accès en cas d’abus.
        </p>
      </Section>

      <Section title="Disponibilité et responsabilité">
        <p>
          Le service est fourni « en l’état ». Nous faisons de notre mieux pour assurer sa disponibilité mais
          ne garantissons pas une absence totale d’interruption. Dans la limite permise par la loi, AfraMAT ne
          saurait être tenu responsable des dommages indirects liés à l’utilisation du service.
        </p>
      </Section>

      <Section title="Modifications">
        <p>
          Nous pouvons faire évoluer le service et ces conditions. Les changements importants seront signalés
          sur cette page.
        </p>
      </Section>

      <Section title="Contact">
        <p>
          Pour toute question :{" "}
          <a href="mailto:contact@aframat.com" className="font-bold text-teal-pressed hover:underline">
            contact@aframat.com
          </a>
          .
        </p>
      </Section>
    </article>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-display font-extrabold text-xl text-ink">{title}</h2>
      <div className="text-[15px] text-muted leading-relaxed">{children}</div>
    </section>
  );
}
