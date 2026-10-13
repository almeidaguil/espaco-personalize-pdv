import { NextRequest, NextResponse } from "next/server";

import { exportSalesReportCsvUseCase } from "@/modules/reports/application/export-sales-report-csv-use-case";
import { getCompleteSalesReportUseCase } from "@/modules/reports/application/get-complete-sales-report-use-case";
import {
  SupabaseSalesReportRepository,
  type SupabaseSalesReportClient,
} from "@/modules/reports/infra/supabase-sales-report-repository";
import { createSupabaseServerClient } from "@/shared/lib/supabase/server-client";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const supabaseClient = await createSupabaseServerClient();
  const { data: authData, error: authError } =
    await supabaseClient.auth.getUser();

  if (authError || !authData.user) {
    return jsonError("Autenticação necessária para exportar o relatório.", 401);
  }

  const result = await getCompleteSalesReportUseCase({
    filters: {
      cashSessionId:
        request.nextUrl.searchParams.get("cashSessionId") ?? undefined,
      endDate: request.nextUrl.searchParams.get("endDate") ?? "",
      operatorId: request.nextUrl.searchParams.get("operatorId") ?? undefined,
      startDate: request.nextUrl.searchParams.get("startDate") ?? "",
    },
    salesReportRepository: new SupabaseSalesReportRepository(
      supabaseClient as unknown as SupabaseSalesReportClient,
    ),
  });

  if (!result.success || "formError" in result) {
    let status = 400;

    if (!result.success && !("formError" in result)) {
      if (result.error === "forbidden") status = 403;
      if (result.error === "unauthorized") status = 401;
      if (result.error === "unknown") status = 500;
    }

    return jsonError("Não foi possível exportar o relatório.", status);
  }

  const csv = exportSalesReportCsvUseCase({ report: result.report });

  return new NextResponse(csv.content, {
    headers: {
      "cache-control": "private, no-store",
      "content-disposition": `attachment; filename="${csv.filename}"`,
      "content-type": csv.mimeType,
    },
    status: 200,
  });
}

function jsonError(message: string, status: number) {
  return NextResponse.json(
    { error: message },
    {
      headers: { "cache-control": "private, no-store" },
      status,
    },
  );
}
