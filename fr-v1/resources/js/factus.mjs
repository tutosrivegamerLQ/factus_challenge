export default class Factus {
  static #table
  static #products_table
  static #modal
  static #del_modal
  static #currentOption
  static #form

  static #customers_option
  static #pay_method_option

  constructor() {
    throw new Error('No requiere instancias, todos los métodos son estáticos. Use Factus.init()')
  }

  static async init() {
    try {
      Factus.#form = await Helpers.fetchText('/resources/html/factus.html')
      let response = await Helpers.fetchJSON(`${urlAPI}/get-data/payment_method`)

      Factus.#pay_method_option = Helpers.toOptionList({
        items: response.data,
        value: 'id',
        text: 'name',
        firstOption: 'Seleccione un método de pago',
      })

      // Intentar cargar los datos de los datos de los clientes
      response = await Helpers.fetchJSON(`${urlAPI}/factura`)
      // response = await Helpers.fetchJSON('/resources/js/facturas_all.json')
      if (!response) {
        throw new Error(response.message)
      }

      Toast.show({ message: 'Cargando datos...', duration: 1000 })

      // Agregar al <main> index.html el contenedor de la tabla
      document.querySelector('main').innerHTML = `
      <h2 class="my-0 mx-4">Facturas</h2>
      <div class="p-2 w-full">
          <div id="table-container" class="m-2 bg-dark"></div>
      </dv>`

      Factus.#table = new Tabulator('#table-container', {
        height: tableHeight,
        data: response.data,
        progressiveLoad: 'scroll',
        layout: 'fitColumns',
        columns: [
          { title: 'ID', field: 'id', hozAlign: 'center', width: 90 },
          { title: 'ESTADO ', field: 'status', hozAlign: 'center', width: 100, formatter: Factus.#status_formatter },
          { title: 'DOCUMENTO', field: 'document.name', hozAlign: 'left', width: 250 },
          { title: 'NÚMERO FACTURA', field: 'number', hozAlign: 'center', width: 180 },
          { title: 'CLIENTE API', field: 'api_client_name', hozAlign: 'left', width: 200 },
          { title: 'ID CLIENTE', field: 'identification', hozAlign: 'center', width: 200 },
          { title: 'NOMBRE CLIENTE', field: 'graphic_representation_name', hozAlign: 'left', width: 200 },
          { title: 'FORMA DE PAGO', field: 'payment_form.name', hozAlign: 'left', width: 200 },
          { title: 'HORA CREACIÓN', field: 'created_at', hozAlign: 'left', width: 350, formatter: Factus.#date_format },
        ],
        responsiveLayout: false, // activado el scroll horizontal, también: ['hide'|true|false]
        initialSort: [
          // establecer el ordenamiento inicial de los datos
          { column: 'id', dir: 'asc' },
        ],
        columnDefaults: {
          tooltip: true, //show tool tips on cells
        },
        // mostrar al final de la tabla un botón para agregar registros
        footerElement: `<div class='container-fluid d-flex justify-content-end p-0'>${addRowButton}</div>`,
      })

      Factus.#table.on('tableBuilt', () => document.querySelectorAll('#add-row').forEach((e) => e.addEventListener('click', Factus.#addRow)))
      // Mostrar información sobre como usar el crud básico
      Customs.showInfoAboutUse('clientes')
    } catch (e) {
      Toast.show({ title: 'Factus', message: 'Falló la carga de la información', mode: 'danger', error: e })
    }

    return this
  }

  /**
   * Dar formato a fechas
   * @param {*} cell Objeto celda de Tabulator
   * @param {*} load ¿Es operación `POST`?
   * @param {*} value Solo si es operación `POST` (`load = true`), valor que se formateará
   * @returns String con formato de fecha según corresponda:<hr> `08:32 p.m., del jueves 23 de enero de 2025` => `load = false` || `23-01-2025 09:16:27 PM` => `load = true`
   */
  static #date_format(cell = null, load = false, value = null) {
    if (cell !== null) {
      const value = cell.getValue()
      const dt = DateTime.fromFormat(value, 'dd-MM-yyyy hh:mm:ss a').setLocale('es-419')

      return dt.toFormat("hh:mm a, 'del' cccc dd 'de' LLLL 'de' yyyy")
    } else if (load === true) {
      return DateTime.fromFormat(value).setLocale('es-419').toFormat('dd-MM-yyyy hh:mm:ss a')
    }
  }

  /**
   * Dar formato al estado de la factura
   * @param {*} cell
   * @returns
   */
  static #status_formatter(cell) {
    const val = cell.getValue()
    return val === 0 ? 'En espera' : 'Enviada'
  }
  /**
   * Disponer diálogo para agregar clientes
   */
  static async #addRow() {
    Factus.#currentOption = 'add'
    Factus.#modal = new Modal({
      modal: false,
      classes: Customs.classesModal, // En customs.mjs están las clases (Se repiten habitualmente)
      title: '<h5>Ingreso de facturas</h5>',
      content: Factus.#form,
      buttons: [
        { caption: addButton, classes: 'btn btn-primary me-2', action: () => Factus.#add() },
        { caption: cancelButton, classes: 'btn btn-secondary', action: () => Factus.#modal.remove() },
      ],
      doSomething: Factus.#displayDataOnForm,
    })

    Factus.#modal.show()
  }

  static async #add() {
    try {
      // Validar formulario
      if (!Helpers.okForm('#form-factus')) {
        Customs.toastBeforeAddRecord()
        return
      }

      // Crear objeto con los datos del formulario
      const body = await Factus.#getFormData()
      console.log(body)

      // Realizar solicitud de registro a la API
      let response = await Helpers.fetchJSON(`${urlAPI}/factura`, {
        method: 'POST',
        body,
      })

      console.log(response)

      // Verificar respuesta de la API
      if (response.status === 200) {
        Toast.show({ message: 'Cliente creado correctamente' })
        Factus.#table.addRow(response.data)
        Factus.#modal.remove()
      } else {
        Toast.show({ message: 'No se pudo agregar el registro', mode: 'danger', error: response })
      }
    } catch (e) {
      Toast.show({ message: 'Falló la operación de creación del registro', mode: 'danger', error: e })
    }
  }

  /**
   * Disponer diálogo para editar clientes
   */
  static #editRowClick = async (e, cell) => {
    Factus.#currentOption = 'edit'
    console.log(cell.getRow().getData())
    Factus.#modal = new Modal({
      modal: false,
      classes: Customs.classesModal, // En customs.mjs están las clases (Se repiten habitualmente)
      title: '<h5>Actualización de mercancías</h5>',
      content: Factus.#form,
      buttons: [
        { caption: editButton, classes: 'btn btn-primary me-2', action: () => Factus.#edit(cell) },
        { caption: cancelButton, classes: 'btn btn-secondary', action: () => Factus.#modal.remove() },
      ],
      doSomething: (idModal) => Factus.#displayDataOnForm(idModal, cell.getRow().getData()),
    })
    Factus.#modal.show()
    // Deshabilitar campo de ID
    document.querySelector(`#form-clientes #id`).disabled = true
  }

  /**
   * Realizar peticiones PATCH a la API con endpoint "mercancia"
   */
  static async #edit(cell) {
    try {
      // Validar formulario
      if (!Helpers.okForm('#form-clientes')) {
        return
      }

      // Obtener los datos del formulario
      const body = Factus.#getFormData()

      // Crear ruta para la solicitud
      const url = `${urlAPI}/cliente/${cell.getRow().getData().id}`

      let response = await Helpers.fetchJSON(url, {
        method: 'PATCH',
        body,
      })

      if (response.status === 200) {
        Toast.show({ message: 'Cliente actualizado correctamente' })
        // actualizar fila correspondiente con la información actualizada
        cell.getRow().update(response.data)
        Factus.#modal.remove()
      } else {
        Toast.show({ message: 'No se pudo actualizar el cliente', mode: 'danger', error: response })
      }
    } catch (e) {
      Toast.show({ message: 'No se pudo actualizar el cliente', mode: 'danger', error: e })
    }
  }

  /**
   * Disponer diálogo con la información del cliente a eliminar
   */
  static #deleteRowClick = async (e, cell) => {
    e.preventDefault()
    Factus.#currentOption = 'delete'
    Factus.#del_modal = new Modal({
      modal: false,
      classes: Customs.classesModal, // En customs.mjs están las clases (Se repiten habitualmente)
      title: '<h5>Eliminar producto</h5>',
      content: `<span class="text-back dark:text-gray-300">
                  Confirme la eliminación del producto: <br>
                  ${cell.getRow().getData().code_reference} - ${cell.getRow().getData().name}<br>
                  Precio: ${cell.getRow().getData().price}<br>
                  Cantidad: ${cell.getRow().getData().quantity}<br>
                </span>`,
      buttons: [
        { caption: deleteButton, classes: 'btn btn-primary me-2', action: () => Factus.#delete(cell) },
        { caption: cancelButton, classes: 'btn btn-secondary', action: () => Factus.#del_modal.remove() },
      ],
    })
    Factus.#del_modal.show()
  }

  /**
   * Eliminar productos
   * @param {*} cell Objeto celda de "Tabulator"
   */
  static async #delete(cell) {
    try {
      Toast.show({ message: 'Producto eliminado exitosamente' })
      cell.getRow().delete()
      Factus.#del_modal.remove()
    } catch (e) {
      Toast.show({ message: 'No se pudo eliminar el cliente', mode: 'danger', error: e })
    }
  }

  static async #displayDataOnForm(idModal, rowData) {
    Factus.#add_listeners(idModal)
    const select_pay_method = document.querySelector(`#${idModal} #pago`)

    select_pay_method.innerHTML = Factus.#pay_method_option

    if (Factus.#currentOption === 'edit') {
      console.log(rowData.ciudad)
      document.querySelector(`#${idModal} #id`).value = rowData.id
      document.querySelector(`#${idModal} #nombre`).value = rowData.nombre
      document.querySelector(`#${idModal} #direccion`).value = rowData.direccion
      document.querySelector(`#${idModal} #telefono`).value = rowData.telefono
    }

    let response = await Helpers.fetchJSON(`${urlAPI}/get-data/customer`)

    Factus.#customers_option = Helpers.toOptionList({
      items: response.data,
      value: 'id',
      text: 'names',
      firstOption: 'Seleccione un cliente',
    })
    const select_client = document.querySelector(`#${idModal} #cliente`)
    select_client.innerHTML = Factus.#customers_option
    Factus.#tab_products(idModal)
  }

  static async #tab_products(idModal) {
    Factus.#products_table = new Tabulator(`#${idModal} #ctn-products`, {
      height: '40vh',
      progressiveLoad: 'scroll',
      layout: 'fitColumns',
      columns: [
        { formatter: deleteRowButton, width: 40, hozAlign: 'center', cellClick: Factus.#deleteRowClick },
        { title: 'ID', field: 'code_reference', hozAlign: 'center', width: 90 },
        { title: 'NOMBRE', field: 'name', hozAlign: 'left', width: 90 },
        { title: 'PRECIO ', field: 'price', hozAlign: 'center', width: 100, formatter: 'money' },
        { title: 'CANTIDAD', field: 'quantity', hozAlign: 'center', width: 100 },
        { title: 'TASA DESCUENTO', field: 'tax_rate', hozAlign: 'center', width: 100 },
        { title: 'PORCENTAJE DESCUENTO', field: 'discount_rate', hozAlign: 'center', width: 100 },
        { title: 'UNIDAD DE MEDIDA', field: 'unit_measure_id', hozAlign: 'left', width: 200 },
        { title: 'TRIBUTO', field: 'tribute_id', hozAlign: 'center', width: 100 },
        { title: 'CÓDIGO ESTÁNDAR', field: 'standard_code_id', hozAlign: 'center', width: 100 },
        { title: 'EXCLUIDO IVA', field: 'is_excluded', hozAlign: 'left', width: 100 },
        { title: 'TASAS RETENCIÓN', field: 'withholding_taxes', hozAlign: 'left', width: 550, formatter: 'json', formatterParams: { multiline: false, indent: ' ' } },
      ],
      responsiveLayout: false, // activado el scroll horizontal, también: ['hide'|true|false]
      initialSort: [
        // establecer el ordenamiento inicial de los datos
        { column: 'id', dir: 'asc' },
      ],
      columnDefaults: {
        tooltip: true, //show tool tips on cells
      },
      // mostrar al final de la tabla un botón para agregar registros
      footerElement: `<div class='container-fluid d-flex justify-content-end p-0'>${addProductButton}</div>`,
    })

    Factus.#products_table.on('tableBuilt', () => document.querySelector('#add-product').addEventListener('click', Factus.#addProduct))
  }

  /**
   * Obtener la lista de productos disponibles
   * @returns `Array`. Productos disponibles
   */
  static async #get_products() {
    let data = await Helpers.fetchJSON(`${urlAPI}/get-data/products`)
    return data.data
  }

  /**
   * Agregar productos a la tabla de productos
   * @param {*} e
   */
  static #addProduct(e) {
    e.preventDefault()
    const buttons = ['<button id="add" class="btn btn-success text-success">Agregar</button>', '<button id="_close" class="btn btn-danger text-danger">Cancelar</button>']
    const html = `<select class="form-control" id="product" name="product" required></select>
    <div id="amounts" class="d-flex justify-content-center align-items-center pb-2">
      <button  id="less"  class="btn btn-danger text-danger d-flex align-items-center justify-content-center"  style="width: 20px; height:47px; border-radius: 90px; font-size:xx-large;">-</button>
      <p id="amount" style="width: 70px; height: 10px; text-align: center;">1</p>
      <button  id="plus"  class="btn btn-success text-success d-flex align-items-center justify-content-center"  style="width: 20px; height:47px; border-radius: 90px; font-size:xx-large;">+</button>
    </div>
    <span class='text-danger' id="spn-error"></span>
    `
    const pop = Customs.popover('Agregar producto', html, buttons)
    Customs.showPopover(pop)
    // Añadir productos disponibles
    Factus.#add_product_list_to_select(pop.id)
    // Añadir funcionalidad a los botones 'less', 'plus'
    document.querySelectorAll(`#${pop.id} #amounts > button`).forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault()
        let p = document.querySelector('#amount')
        let val = parseInt(p.textContent)
        if (val > 1 && e.target.id === 'less') val--
        if (e.target.id === 'plus') val++
        p.textContent = val
      })
    })
    // Añadir eventos
    document.querySelector(`#${pop.id} #add`).addEventListener('click', async (e) => {
      e.preventDefault()
      const product_code = document.querySelector(`#${pop.id} #product`).value
      let amount_ctn = document.querySelector('#amount')
      let quantity = parseInt(amount_ctn.textContent)
      const span_error = document.querySelector(`#${pop.id} #spn-error`)
      if (!product_code) {
        span_error.innerHTML = `Debe seleccionar un producto antes`
        let timeout = setTimeout(() => {
          span_error.innerHTML = ''
          timeout = null
        }, 2000)
        return false
      }
      const product = await Helpers.fetchJSON(`${urlAPI}/get-join`, {
        method: 'POST',
        body: { query: `SELECT * FROM products WHERE code_reference = '${product_code}'` },
      })
      Customs.closePopover(pop)
      // Añadir cantidades y precios
      product.data[0].quantity = quantity
      product.data[0].price *= quantity
      console.log(product.data)
      Factus.#products_table.addRow(product.data)
    })

    document.querySelector(`#${pop.id} #_close`).addEventListener('click', (e) => Customs.closePopover(pop))
  }

  static async #add_product_list_to_select(idPop) {
    const select = document.querySelector(`#${idPop} #product`)
    const list_products = Helpers.toOptionList({
      items: await Factus.#get_products(),
      value: 'code_reference',
      text: 'name',
      firstOption: 'Seleccione un producto',
    })
    select.innerHTML = list_products
  }

  /**
   * Redireccionar a la página de clientes
   * @param {String} idModal
   */
  static #add_listeners(idModal) {
    const btn_new_client = document.querySelector(`#${idModal} #new-client`)
    btn_new_client.addEventListener('click', (e) => {
      e.preventDefault()
      Customs.new_client()
    })
  }

  /**
   * Recupera los datos del formulario y crea un objeto para ser retornado
   * @returns Un objeto con los datos del usuario
   */
  static async #getFormData() {
    // Guardar el índice seleccionado en el <select> ciudad
    const idModal = Factus.#modal.id
    // const index = cities.selectedIndex
    const customer_id = document.querySelector(`#${idModal} #cliente`).value
    const res = await Helpers.fetchJSON(`${urlAPI}/get-join/`, {
      method: 'POST',
      body: { query: `SELECT * FROM customer WHERE id = '${customer_id}'` },
    })

    if (res.data[0].hasOwnProperty('verification_digit')) {
      if (res.data[0].verification_digit === null) delete res.data[0].verification_digit
      else res.data[0].dv = res.data[0].verification_digit
      delete res.data[0].verification_digit
    }
    console.log(res)

    res.data[0].identification = res.data[0].id
    res.data[0].identification_document_id = res.data[0].type_id
    res.data[0].legal_organization_id = res.data[0].id_org
    delete res.data[0].id
    delete res.data[0].type_id
    delete res.data[0].id_org

    let data = {
      observation: document.querySelector(`#${idModal} #observacion`).value,
      payment_method_code: parseInt(document.querySelector(`#${idModal} #pago`).value),
      customer: res.data[0],
      items: Factus.#products_table.getData(),
    }

    // console.log(data)

    return data
  }

  /*
  const body = {
    // observation: 'Aún estarán en live? en tiktok?',
    // payment_method_code: 10, // metodo de pago se consume por tabla, en documentacion
    customer: {
      identification: '123456789',
      dv: 3, // Digito de verificacion. se envia si es nit
      company: '',
      trade_name: '',
      names: 'Tutos Sirve*',
      address: 'calle 1 # 2-68',
      email: 'tutosirve@enigmasas.com',
      phone: '1234567890',
      legal_organization_id: 2, //TIpo de organizacion, persona natural o juridica. se consume de tabla
      tribute_id: 21, // Si aplica o no aplica iva. se consume de tabla
      identification_document_id: 3, // Tipo de identificacion se consume de tabla
      municipality_id: 980, // municipio del cliente, se consume del endpoint municipios
    },
    items: [
      {
        code_reference: '12345',
        name: 'Factus versión PRO',
        quantity: 1, //requerido
        discount_rate: 20, // valor del porcentatje de descuento
        price: 5000000,
        tax_rate: '19.00', // valor del descuento aplicado
        unit_measure_id: 70, // se consume del endpoint unidad de medida
        standard_code_id: 1, // codigo para productos o serviciois se consume de tabla
        is_excluded: 0, // excluido de iva o no
        tribute_id: 1, // Tributto aplicado, se consume de endpoint tributo productos
        withholding_taxes: [
          // array de las tasas de retencion se cosume del endpoint tribuos
          {
            code: '06',
            withholding_tax_rate: '7.00',
          },
          {
            code: '05',
            withholding_tax_rate: '15.00',
          },
        ],
      },
      {
        code_reference: '12345',
        name: 'producto de prueba 2',
        quantity: 1, // requerido
        discount: 0, //requerido, si no tiene descuento debe ir en 0
        discount_rate: 0,
        price: 50000,
        tax_rate: '5.00',
        unit_measure_id: 70, // requerido por defecto 70
        standard_code_id: 1,
        is_excluded: 0,
        tribute_id: 1,
        withholding_taxes: [],
      },
    ],
  };
  */
}
