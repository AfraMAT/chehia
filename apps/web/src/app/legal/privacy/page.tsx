import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Confidentialité — Chehia",
  description: "Politique de confidentialité de Chehia.",
};

/** Privacy policy (FR — primary market). Concise, accurate to what the app does. */
export default function PrivacyPage() {
  return (
    <article className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="font-display font-extrabold text-3xl text-ink">Politique de confidentialité</h1>
        <p className="text-[13px] text-muted-soft">Dernière mise à jour : juillet 2026</p>
      </header>

      <p className="text-[15px] text-muted leading-relaxed">
        Chehia est un service de commande à table par QR code pour les cafés et restaurants, édité par
        AfraMAT. Cette page explique quelles données nous traitons et pourquoi. Nous collectons le minimum
        nécessaire au fonctionnement du service.
      </p>

      <Section title="Données que nous traitons">
        <ul className="list-disc ps-5 flex flex-col gap-1.5">
          <li><b>Commandes.</b> Les articles commandés, la table, la langue et l’horodatage. Les clients commandent via une session <b>anonyme</b> — aucun compte ni identité n’est requis.</li>
          <li><b>Comptes du personnel.</b> Pour les établissements : e-mail et rôle des membres de l’équipe, afin d’accéder au portail.</li>
          <li><b>Demandes de contact.</b> Si vous nous écrivez via le formulaire « restaurateurs » : nom, établissement, e-mail, téléphone, ville, message, et votre adresse IP (à des fins de prévention du spam).</li>
          <li><b>Préférences locales.</b> Votre panier et votre langue sont conservés dans le stockage local de votre navigateur (localStorage), sur votre appareil.</li>
        </ul>
      </Section>

      <Section title="Ce que nous ne collectons pas">
        <p>
          Chehia est un service <b>« commande seule »</b> : le paiement se fait au comptoir. Nous ne
          collectons ni ne stockons aucune donnée de carte bancaire.
        </p>
      </Section>

      <Section title="Hébergement et sécurité">
        <p>
          Les données sont hébergées chez Supabase, dans l’Union européenne (région eu-west-3, Paris).
          L’accès est protégé par des règles de sécurité au niveau des lignes (Row-Level Security) : un
          établissement ne voit que ses propres données.
        </p>
      </Section>

      <Section title="Conservation">
        <p>
          Les commandes sont conservées pour le suivi et les statistiques de l’établissement. Les demandes
          de contact sont conservées le temps de traiter votre demande. Vous pouvez demander la suppression
          de vos données à tout moment.
        </p>
      </Section>

      <Section title="Vos droits / contact">
        <p>
          Pour toute question, demande d’accès ou de suppression, écrivez-nous à{" "}
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
