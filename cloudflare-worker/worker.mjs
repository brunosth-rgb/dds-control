// DDS Control - Proxy seguro para a API Hashdata.
//
// Cloudflare vars/secrets:
// HASHDATA_API_TOKEN -> Secret
// FIREBASE_PROJECT_ID -> Variable
// ALLOWED_ORIGINS -> Variable
//
// Opcional:
// HASHDATA_FORM_ID -> Variable
//
// Se HASHDATA_FORM_ID não estiver configurado,
// será usado o formulário atual abaixo.
//
// A autorização usa ddsUsers/{uid} no Firestore.

const DEFAULT_FORM_ID = '6abbeeab1990ff984e83a4ef';

const BASE =
  'https://api2.hashdata.app/v1/export/forms';


function formId(env) {
  const configured =
    String(
      env.HASHDATA_FORM_ID || ''
    ).trim();

  if (
    /^[A-Za-z0-9_-]{10,100}$/.test(
      configured
    )
  ) {
    return configured;
  }

  return DEFAULT_FORM_ID;
}


function allowedOrigins(env) {
  return String(
    env.ALLOWED_ORIGINS || ''
  )
    .split(',')
    .map(
      value =>
        value
          .trim()
          .replace(/\/$/, '')
    )
    .filter(Boolean);
}


function corsHeaders(
  request,
  env
) {
  const origin =
    request.headers.get(
      'Origin'
    ) || '';

  const allowed =
    allowedOrigins(env);

  const headers = {
    'Access-Control-Allow-Headers':
      'Authorization, Content-Type',

    'Access-Control-Allow-Methods':
      'GET, OPTIONS',

    'Access-Control-Max-Age':
      '86400',

    Vary: 'Origin',
  };

  if (
    allowed.includes(origin)
  ) {
    headers[
      'Access-Control-Allow-Origin'
    ] = origin;
  }

  return headers;
}


function json(
  request,
  env,
  body,
  status = 200
) {
  return Response.json(
    body,
    {
      status,

      headers: {
        ...corsHeaders(
          request,
          env
        ),

        'Cache-Control':
          'no-store',

        'X-Content-Type-Options':
          'nosniff',
      },
    }
  );
}


function tokenPayload(
  token
) {
  try {
    const part =
      token.split('.')[1];

    if (!part) {
      return null;
    }

    const normalized =
      part
        .replace(/-/g, '+')
        .replace(/_/g, '/');

    const padded =
      normalized +
      '='.repeat(
        (
          4 -
          normalized.length % 4
        ) % 4
      );

    return JSON.parse(
      atob(padded)
    );
  } catch {
    return null;
  }
}


async function authorizedFirebaseUser(
  request,
  env
) {
  const authorization =
    request.headers.get(
      'Authorization'
    ) || '';

  const token =
    authorization.startsWith(
      'Bearer '
    )
      ? authorization
          .slice(7)
          .trim()
      : '';

  if (
    !token ||
    token.length > 8192
  ) {
    return null;
  }

  if (
    !env.FIREBASE_PROJECT_ID
  ) {
    throw new Error(
      'FIREBASE_PROJECT_ID não configurado no Worker.'
    );
  }

  const payload =
    tokenPayload(token);

  const uid =
    String(
      payload?.user_id ||
      payload?.sub ||
      ''
    );

  if (
    !/^[A-Za-z0-9:_-]{1,128}$/.test(
      uid
    )
  ) {
    return null;
  }

  const project =
    encodeURIComponent(
      env.FIREBASE_PROJECT_ID
    );

  const path =
    `https://firestore.googleapis.com/v1/projects/${project}` +
    `/databases/(default)/documents/ddsUsers/${encodeURIComponent(uid)}`;

  const response =
    await fetch(
      path,
      {
        headers: {
          Authorization:
            `Bearer ${token}`,
        },

        signal:
          AbortSignal.timeout(
            10000
          ),
      }
    );

  if (
    !response.ok
  ) {
    return null;
  }

  const document =
    await response.json();

  const active =
    document
      ?.fields
      ?.active
      ?.booleanValue === true;

  if (!active) {
    return null;
  }

  return {
    uid,
  };
}


function validOrigin(
  request,
  env
) {
  const origin =
    request.headers.get(
      'Origin'
    );

  if (!origin) {
    return true;
  }

  return allowedOrigins(
    env
  ).includes(
    origin.replace(
      /\/$/,
      ''
    )
  );
}


function cleanDateParam(
  value
) {
  if (!value) {
    return '';
  }

  return String(value)
    .trim()

    // Remove aspas que eventualmente
    // tenham sido acrescentadas na URL.
    .replace(
      /^["']+|["']+$/g,
      ''
    );
}


function canonicalUtcDate(
  value
) {
  const cleaned =
    cleanDateParam(
      value
    );

  const timestamp =
    Date.parse(cleaned);

  if (
    !Number.isFinite(
      timestamp
    )
  ) {
    return null;
  }

  return new Date(
    timestamp
  ).toISOString();
}


function readableUpstreamError(
  status,
  bodyText
) {
  let remoteMessage = '';

  try {
    const parsed =
      JSON.parse(bodyText);

    remoteMessage =
      String(
        parsed?.message ||
        parsed?.error ||
        parsed?.detail ||
        ''
      ).trim();
  } catch {
    remoteMessage =
      bodyText
        .replace(
          /\s+/g,
          ' '
        )
        .trim()
        .slice(
          0,
          300
        );
  }

  if (
    status === 401
  ) {
    return (
      'Hashdata recusou o token da API (HTTP 401). ' +
      'Verifique ou gere novamente o HASHDATA_API_TOKEN.'
    );
  }

  if (
    status === 403
  ) {
    return (
      'Hashdata recusou o acesso (HTTP 403). ' +
      'Verifique as permissões do token e se o formulário está habilitado para exportação via REST API.'
    );
  }

  if (
    status === 404
  ) {
    return (
      'Formulário não encontrado na API Hashdata (HTTP 404). ' +
      'Verifique o FORM_ID e se o formulário está habilitado para REST API.'
    );
  }

  if (
    status === 429
  ) {
    return (
      'A API Hashdata limitou temporariamente as requisições (HTTP 429).'
    );
  }

  if (
    status >= 500
  ) {
    return (
      `A API Hashdata retornou erro HTTP ${status}.` +
      (
        remoteMessage
          ? ` ${remoteMessage}`
          : ''
      )
    );
  }

  return (
    `A API Hashdata retornou HTTP ${status}.` +
    (
      remoteMessage
        ? ` ${remoteMessage}`
        : ''
    )
  );
}


async function hashdataFetch(
  url,
  env
) {
  const execute =
    () =>
      fetch(
        url,
        {
          headers: {
            'HD-API-TOKEN':
              env.HASHDATA_API_TOKEN,

            Accept:
              'application/json',
          },

          redirect:
            'follow',

          signal:
            AbortSignal.timeout(
              25000
            ),
        }
      );


  let response =
    await execute();


  /*
   * Uma segunda tentativa somente
   * para erros temporários.
   */
  if (
    [
      429,
      502,
      503,
      504,
    ].includes(
      response.status
    )
  ) {
    await new Promise(
      resolve =>
        setTimeout(
          resolve,
          500
        )
    );

    response =
      await execute();
  }


  return response;
}


export default {
  async fetch(
    request,
    env
  ) {

    if (
      request.method ===
      'OPTIONS'
    ) {
      if (
        !validOrigin(
          request,
          env
        )
      ) {
        return new Response(
          null,
          {
            status: 403,
          }
        );
      }

      return new Response(
        null,
        {
          status: 204,

          headers:
            corsHeaders(
              request,
              env
            ),
        }
      );
    }


    const url =
      new URL(
        request.url
      );


    if (
      request.method !==
      'GET'
    ) {
      return json(
        request,
        env,
        {
          error:
            'Método não permitido.',
        },
        405
      );
    }


    if (
      !validOrigin(
        request,
        env
      )
    ) {
      return json(
        request,
        env,
        {
          error:
            'Origem não autorizada.',
        },
        403
      );
    }


    if (
      url.pathname === '/'
    ) {
      return json(
        request,
        env,
        {
          service:
            'DDS Hashdata',

          status:
            'Disponível',

          formId:
            formId(env),
        }
      );
    }


    if (
      ![
        '/forms',
        '/responses',
      ].includes(
        url.pathname
      )
    ) {
      return json(
        request,
        env,
        {
          error:
            'Não encontrado.',
        },
        404
      );
    }


    try {
      const user =
        await authorizedFirebaseUser(
          request,
          env
        );

      if (!user) {
        return json(
          request,
          env,
          {
            error:
              'Acesso não autorizado.',
          },
          401
        );
      }
    } catch (error) {
      return json(
        request,
        env,
        {
          error:
            error instanceof Error
              ? error.message
              : 'Falha na autenticação.',
        },
        503
      );
    }


    if (
      !env.HASHDATA_API_TOKEN
    ) {
      return json(
        request,
        env,
        {
          error:
            'Token Hashdata não configurado.',
        },
        503
      );
    }


    const selectedFormId =
      formId(env);

    let upstream =
      BASE;

    let from = '';
    let to = '';


    if (
      url.pathname ===
      '/responses'
    ) {
      const rawFrom =
        url.searchParams.get(
          'from'
        );

      const rawTo =
        url.searchParams.get(
          'to'
        );


      from =
        canonicalUtcDate(
          rawFrom
        ) || '';

      to =
        canonicalUtcDate(
          rawTo
        ) || '';


      if (
        !from ||
        !to
      ) {
        return json(
          request,
          env,
          {
            error:
              'Informe from e to em formato de data válido.',
          },
          400
        );
      }


      const fromMs =
        Date.parse(from);

      const toMs =
        Date.parse(to);


      if (
        toMs <= fromMs
      ) {
        return json(
          request,
          env,
          {
            error:
              'A data final deve ser posterior à data inicial.',
          },
          400
        );
      }


      if (
        toMs - fromMs >
        31 *
        86400000
      ) {
        return json(
          request,
          env,
          {
            error:
              'O intervalo máximo para consulta é de 31 dias.',
          },
          400
        );
      }


      const query =
        new URLSearchParams({
          from,
          to,

          removeNewLineFromTexts:
            'true',
        });


      upstream =
        `${BASE}/${encodeURIComponent(selectedFormId)}/responses?${query.toString()}`;
    }


    try {
      const response =
        await hashdataFetch(
          upstream,
          env
        );


      const bodyText =
        await response.text();


      if (
        !response.ok
      ) {
        const message =
          readableUpstreamError(
            response.status,
            bodyText
          );


        console.error(
          JSON.stringify({
            event:
              'hashdata-upstream-error',

            path:
              url.pathname,

            formId:
              selectedFormId,

            upstreamStatus:
              response.status,

            from:
              from || null,

            to:
              to || null,

            response:
              bodyText
                .replace(
                  /\s+/g,
                  ' '
                )
                .slice(
                  0,
                  500
                ),
          })
        );


        return json(
          request,
          env,
          {
            error:
              message,

            upstreamStatus:
              response.status,

            formId:
              selectedFormId,
          },
          502
        );
      }


      let rows;

      try {
        rows =
          JSON.parse(
            bodyText
          );
      } catch {
        console.error(
          JSON.stringify({
            event:
              'hashdata-invalid-json',

            path:
              url.pathname,

            formId:
              selectedFormId,

            upstreamStatus:
              response.status,

            response:
              bodyText
                .replace(
                  /\s+/g,
                  ' '
                )
                .slice(
                  0,
                  500
                ),
          })
        );


        return json(
          request,
          env,
          {
            error:
              'A Hashdata respondeu com um formato que não é JSON.',

            upstreamStatus:
              response.status,
          },
          502
        );
      }


      if (
        !Array.isArray(
          rows
        )
      ) {
        console.error(
          JSON.stringify({
            event:
              'hashdata-unexpected-format',

            path:
              url.pathname,

            formId:
              selectedFormId,

            type:
              typeof rows,
          })
        );


        return json(
          request,
          env,
          {
            error:
              'Formato inesperado na API Hashdata.',

            upstreamStatus:
              response.status,
          },
          502
        );
      }


      if (
        url.pathname ===
        '/forms'
      ) {
        const selected =
          rows.find(
            item =>
              item?.form_id ===
              selectedFormId
          );


        return json(
          request,
          env,
          {
            formId:
              selectedFormId,

            available:
              !!selected,

            form:
              selected
                ? {
                    form_id:
                      selected.form_id,

                    form_name:
                      selected.form_name,

                    form_status:
                      selected.form_status,
                  }
                : null,

            totalForms:
              rows.length,
          }
        );
      }


      return json(
        request,
        env,
        {
          formId:
            selectedFormId,

          records:
            rows,

          count:
            rows.length,

          from,
          to,

          fetchedAt:
            new Date()
              .toISOString(),
        }
      );


    } catch (error) {

      console.error(
        JSON.stringify({
          event:
            'hashdata-fetch-exception',

          path:
            url.pathname,

          formId:
            selectedFormId,

          message:
            error instanceof Error
              ? error.message
              : String(error),
        })
      );


      return json(
        request,
        env,
        {
          error:
            error instanceof Error &&
            error.name ===
              'TimeoutError'
              ? 'A API Hashdata não respondeu dentro do tempo limite.'
              : 'Falha de conexão ou leitura da API Hashdata.',
        },
        502
      );
    }
  },
};
