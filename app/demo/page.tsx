"use client";

import * as React from "react";
import { User, Car, Wrench, Wallet, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Wizard, type WizardStep } from "@/components/ui/wizard";
import { Stepper } from "@/components/ui/stepper";
import { Card } from "@/components/ui/card";

/**
 * Temporary demo page used to verify the new ui primitives (Stepper,
 * Tabs, Wizard) before wiring them into the real forms. Open each
 * dialog and walk through the flow to make sure the animations,
 * navigation and validation hooks behave as expected.
 */
export default function DemoPage() {
  return (
    <main className="min-h-screen bg-background text-foreground p-6 md:p-10 space-y-8 max-w-3xl mx-auto">
      <header className="space-y-1.5">
        <h1 className="text-2xl font-extrabold">UI Primitives — Demo</h1>
        <p className="text-sm text-muted-foreground">
          Stepper, Tabs y Wizard corriendo en dialogs. Si los ves y se
          sienten bien, los migramos a los formularios reales.
        </p>
      </header>

      {/* ── Demo 1: Standalone Stepper ───────────────────────────────── */}
      <Card className="p-5 space-y-4">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
            1. Stepper solo
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Indicador horizontal de progreso. Click en un paso completado
            para navegar hacia atrás.
          </p>
        </div>
        <StandaloneStepperDemo />
      </Card>

      {/* ── Demo 2: Tabs en un Dialog ────────────────────────────────── */}
      <Card className="p-5 space-y-4">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
            2. Tabs dentro de Dialog
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Nivel 2: formularios medianos con 8-12 campos que se agrupan
            en secciones.
          </p>
        </div>
        <TabsDemoDialog />
      </Card>

      {/* ── Demo 3: Wizard en un Dialog ──────────────────────────────── */}
      <Card className="p-5 space-y-4">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
            3. Wizard dentro de Dialog
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Nivel 1: formularios grandes con muchos campos, divididos
            en pasos lógicos. El botón &ldquo;Siguiente&rdquo; se
            deshabilita si el campo requerido está vacío.
          </p>
        </div>
        <WizardDemoDialog />
      </Card>
    </main>
  );
}

// ── Demo helpers ─────────────────────────────────────────────────────

function StandaloneStepperDemo() {
  const [active, setActive] = React.useState("foto");
  const steps = [
    { id: "foto", label: "Foto" },
    { id: "doc", label: "Documentos" },
    { id: "lic", label: "Licencia" },
    { id: "dom", label: "Domicilio" },
  ];
  return <Stepper steps={steps} currentStep={active} onStepClick={setActive} />;
}

function TabsDemoDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button className="rounded-xl h-10 px-4 text-xs font-bold">
          <Wrench className="w-3.5 h-3.5 mr-1.5" />
          Abrir &laquo;Registrar Servicio&raquo;
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md md:max-w-lg">
        <DialogHeader>
          <DialogTitle>Registrar Servicio</DialogTitle>
          <DialogDescription>
            Nissan Versa · Placa ABC-123
          </DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="servicio" className="w-full">
          <TabsList>
            <TabsTrigger value="servicio" icon={<Wrench className="w-3.5 h-3.5" />}>
              Servicio
            </TabsTrigger>
            <TabsTrigger value="proximo" icon={<ClipboardList className="w-3.5 h-3.5" />}>
              Próximo
            </TabsTrigger>
            <TabsTrigger value="pago" icon={<Wallet className="w-3.5 h-3.5" />}>
              Pago
            </TabsTrigger>
          </TabsList>
          <TabsContent value="servicio" className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="cost">Costo del servicio</Label>
              <Input id="cost" type="number" placeholder="ej. 1800" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="date">Fecha del servicio</Label>
              <Input id="date" type="date" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="desc">Descripción</Label>
              <Input id="desc" placeholder="ej. Cambio de bujías" />
            </div>
          </TabsContent>
          <TabsContent value="proximo" className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="next-km">Próximo servicio (km)</Label>
              <Input id="next-km" type="number" placeholder="ej. 25000" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="next-date">Próximo servicio (fecha)</Label>
              <Input id="next-date" type="date" />
            </div>
          </TabsContent>
          <TabsContent value="pago" className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="paid-by">Pagado por</Label>
              <Input id="paid-by" placeholder="ej. Conductor / Empresa" />
            </div>
          </TabsContent>
        </Tabs>
        <div className="flex justify-end gap-2 pt-4 border-t border-border/60">
          <Button variant="outline" className="rounded-xl h-10 text-xs font-bold">
            Cancelar
          </Button>
          <Button className="rounded-xl h-10 text-xs font-bold">Guardar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function WizardDemoDialog() {
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [curp, setCurp] = React.useState("");
  const [license, setLicense] = React.useState("");

  const steps: WizardStep[] = [
    {
      id: "identidad",
      label: "Identidad",
      icon: <User className="w-3.5 h-3.5" />,
      canAdvance: () => name.trim().length > 0,
      content: (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Empecemos con el nombre del conductor.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="demo-name">Nombre completo *</Label>
            <Input
              id="demo-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ej. Juan Pérez"
            />
          </div>
        </div>
      ),
    },
    {
      id: "documentos",
      label: "Documentos",
      icon: <ClipboardList className="w-3.5 h-3.5" />,
      canAdvance: () => curp.trim().length >= 18,
      content: (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Captura la CURP (mínimo 18 caracteres para poder avanzar).
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="demo-curp">CURP *</Label>
            <Input
              id="demo-curp"
              value={curp}
              onChange={(e) => setCurp(e.target.value.toUpperCase())}
              placeholder="18 caracteres"
            />
            {curp.length > 0 && curp.length < 18 && (
              <p className="text-xs text-amber-500">
                Faltan {18 - curp.length} caracteres
              </p>
            )}
          </div>
        </div>
      ),
    },
    {
      id: "vehiculo",
      label: "Vehículo",
      icon: <Car className="w-3.5 h-3.5" />,
      canAdvance: () => license.trim().length > 0,
      content: (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Por último, asigna un vehículo.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="demo-license">Número de licencia *</Label>
            <Input
              id="demo-license"
              value={license}
              onChange={(e) => setLicense(e.target.value)}
              placeholder="ej. 12345678"
            />
          </div>
        </div>
      ),
    },
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="rounded-xl h-10 px-4 text-xs font-bold">
          <User className="w-3.5 h-3.5 mr-1.5" />
          Abrir &laquo;Registrar Conductor&raquo;
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md md:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Registro de Conductor</DialogTitle>
          <DialogDescription>
            3 pasos. Tu progreso se guarda al avanzar.
          </DialogDescription>
        </DialogHeader>
        <Wizard
          steps={steps}
          onFinish={() => {
            setOpen(false);
            setName("");
            setCurp("");
            setLicense("");
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
