import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import PublicFormRenderer from '@/components/PublicFormRenderer';

interface EmbedFormPageProps {
  params: {
    publicUrl: string;
  };
}

async function getForm(publicUrl: string) {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/public/forms/${publicUrl}/embed`,
      {
        cache: 'no-store',
      }
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data.data.form;
  } catch (error) {
    console.error('Error fetching embed form:', error);
    return null;
  }
}

export async function generateMetadata({
  params,
}: EmbedFormPageProps): Promise<Metadata> {
  const form = await getForm(params.publicUrl);

  if (!form) {
    return {
      title: 'Form Not Found',
      description: 'The requested form could not be found.',
    };
  }

  return {
    title: form.title,
    description: form.description || `Fill out the ${form.title} form`,
    robots: {
      index: false, // Don't index embed pages
      follow: false,
    },
  };
}

export default async function EmbedFormPage({ params }: EmbedFormPageProps) {
  const form = await getForm(params.publicUrl);

  if (!form) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Minimal embed version without header/footer */}
      <div className="p-4">
        <div className="max-w-2xl mx-auto">
          {/* Form Header */}
          <div className="mb-6">
            {form.customization?.logoUrl && (
              <div className="mb-4">
                <img
                  src={form.customization.logoUrl}
                  alt="Form Logo"
                  className="h-12 w-auto mx-auto"
                />
              </div>
            )}
            
            <div className="text-center">
              <h1 
                className="text-2xl font-bold mb-2"
                style={{ 
                  color: form.customization?.primaryColor || '#3b82f6',
                  fontFamily: form.customization?.fontFamily || 'Inter'
                }}
              >
                {form.title}
              </h1>
              {form.description && (
                <p className="text-gray-600">{form.description}</p>
              )}
            </div>
          </div>

          {/* Embed the form renderer */}
          <PublicFormRenderer form={form} />
        </div>
      </div>
    </div>
  );
}