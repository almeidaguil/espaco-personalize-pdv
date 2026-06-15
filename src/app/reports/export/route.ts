import { NextRequest, NextResponse } from "next/server";

import { exportSalesByEventCsvUseCase } from "@/modules/reports/application/export-sales-by-event-csv-use-case";
import { getSalesByEventReportUseCase } from "@/modules/reports/application/get-sales-by-event-report-use-case";
import {
  SupabaseSalesByEventReportRepository,
  type SupabaseSalesByEventReportClient,
} from "@/modules/reports/infra/supabase-sales-by-event-report-repository";
import { createSupabaseServerClient } from "@/shared/lib/supabase/server-client";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const eventId = request.nextUrl.searchParams.get("eventId") ?? "";
  const supabaseClient = await createSupabaseServerClient();
  const result = await getSalesByEventReportUseCase({
    eventId,
    salesByEventReportRepository: new SupabaseSalesByEventReportRepository(
      supabaseClient as unknown as SupabaseSalesByEventReportClient,
    ),
  });

  if (!result.success || "formError" in result) {
    return NextResponse.json(
      {
        error: "Nao foi possivel exportar o relatorio.",
      },
      {
        status: 400,
      },
    );
  }

  const csv = exportSalesByEventCsvUseCase({
    report: result.report,
  });

  return new NextResponse(csv.content, {
    headers: {
      "content-disposition": `attachment; filename="${csv.filename}"`,
      "content-type": csv.mimeType,
    },
    status: 200,
  });
}
