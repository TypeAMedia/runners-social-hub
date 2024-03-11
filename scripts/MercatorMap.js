class MercatorMap {
	constructor(params) {
		this.attrs = Object.assign(
			{
				container: 'body',
				id: Math.floor(Math.random() * 10000000),
				width: 400,
				height: 400,
				margin: {
					top: 0,
					left: 0,
					bottom: 30,
					right: 0,
				},
				colors: {
					layers: ['#589A2E'],
					strokeColor: '#ffffff',
					fillColor: '#00AFCA',
				},
				featureStrokeWidth: 0,
				basemap: {},
				layer: [],
				zoomExtent: [1, 8],
				objectsField: 'collection',
				onZoom: () => { },
				beforeRender: () => { },
				getTooltipHtml: () => { },
				onPinClick: () => { },
			},
			params
		)
		this.main()
	}

	main(resize) {
		const { attrs } = this

		this.currentTransform = d3.zoomIdentity
		this.container = d3.select(attrs.container)

		this.geoFeatures =
			attrs.basemap.type === 'Topology'
				? topojson.feature(
					attrs.basemap,
					attrs.basemap.objects[attrs.objectsField]
				)
				: attrs.basemap

		this.setDimensions()

		// projection
		this.projection = d3
			.geoMercator()
			.fitSize([this.chartWidth, this.chartHeight], this.geoFeatures)

		// path generator
		this.path = d3.geoPath().projection(this.projection)

		//Add svg
		this.svg = this.container
			.patternify({
				tag: 'svg',
				selector: 'chart-svg',
			})
			.attr('width', attrs.width)
			.attr('height', attrs.height)
			.on('click', () => this.highlightPin(() => false))

		//Add chart group
		this.chart = this.svg
			.patternify({
				tag: 'g',
				selector: 'chart',
			})
			.attr('transform', () => {
				return `translate(${attrs.margin.left},${attrs.margin.top})`
			})

		//Add chart inner group
		this.chartInner = this.chart.patternify({
			tag: 'g',
			selector: 'chart-inner',
		})

		attrs.beforeRender(this.chartInner)

		this.drawFeatures()

		this.drawLayer(resize)

		const zoom = d3
			.zoom()
			.scaleExtent(attrs.zoomExtent)
			.on('zoom', e => {
				this.chartInner.attr('transform', e.transform)

				const scale = Math.max(1, e.transform.k)

				this.featuresDom.attr('stroke-width', attrs.featureStrokeWidth / scale)

				this.pinsDom
					.select('.pin-content')
					.attr('transform', `scale(${1 / scale})`)
				this.currentTransform = e.transform

				tippy.hideAll()

				attrs.onZoom(e.transform)
			})
			.on('end', () => { })

		this.zoom = zoom

		if (window.innerWidth > 576) {
			this.svg.call(zoom).on('dblclick.zoom', null)
		} else {
			this.svg.call(zoom).on('dblclick.zoom', null).on('wheel.zoom', null)
		}
	}

	drawFeatures() {
		const { attrs } = this

		const mapContainer = this.chartInner.patternify({
			tag: 'g',
			selector: 'map-container',
		})

		this.featuresDom = mapContainer
			.patternify({
				tag: 'path',
				selector: 'feature',
				data: this.geoFeatures.features,
			})
			.attr('stroke', attrs.colors.strokeColor)
			.attr('stroke-width', attrs.featureStrokeWidth / this.currentTransform.k)
			.attr('fill', attrs.colors.fillColor)
			.attr('d', this.path)
	}

	getPin(d) {
		return `
      <g transform="translate(-13, -40) scale(0.8)" transform-origin="13 40">
        <g class="pin-content" transform-origin="13 40" transform="scale(${1 / this.currentTransform.k})">
          <path d="M18.5173 25.7125L13.3717 40.8706L8.22614 25.7125C4.97537 24.3565 2.39047 21.7714 1.03444 18.5208C-1.8089 11.703 1.41073 3.87461 8.22386 1.03316C15.0394 -1.80795 22.8678 1.41168 25.7092 8.22485C28.5525 15.0403 25.3305 22.8687 18.5173 25.7125Z" fill="#101921"/>
          <text class="rank-text" x="13" y="17" text-anchor="middle">${d['overall rank']}</text>
        </g>
      </g>
    `
	}

	drawLayer(resize) {
		const {
			attrs: { layer, onPinClick, getTooltipHtml },
		} = this

		const layerGroup = this.chartInner.patternify({
			tag: 'g',
			selector: 'layer-group',
		})
		const self = this
		const dy = resize ? 0 : 35

		this.pinsDom = layerGroup
			.patternify({
				tag: 'g',
				selector: 'pin',
				data: layer.map(d => {
					const [x, y] = this.projection([d.Longitude, d.Latitude])
					return {
						...d,
						x,
						y
					}
				}),
			})
			.classed('highlighted', d => d.highlighted)
			.attr('transform', d => {
				return `translate(${d.x},${d.y})`
			})
			.sort((a, b) => {
				return a.y - b.y;
			})
			.html(d => this.getPin(d))
			.on('mouseover click', function (e, d) {
				const pin = d3.select(this)

				self.pinsDom.style('opacity', 0.5)

				pin
					.style('opacity', 1)
					.selectAll('.pin-content')
					.classed('transition-on', true)
					.attr('transform', `scale(${1.5 / self.currentTransform.k})`)
			})
			.on('mouseout', function () {
				const pin = d3.select(this)

				self.pinsDom.style('opacity', 1)

				const pinContent = pin
					.selectAll('.pin-content')
					.attr('transform', `scale(${1 / self.currentTransform.k})`)

				setTimeout(() => {
					pinContent.classed('transition-on', false)
				}, 300)

			})

		// if (!resize) {
		// 	this.pinsDom
		// 		.transition()
		// 		.delay((d, i) => {
		// 			return i * 50 * Math.random()
		// 		})
		// 		.duration(350)
		// 		.attr('transform', d => {
		// 			return `translate(${d.x},${d.y})`
		// 		})
		// }

		this.pinsDom.each(function (d) {
			initTooltip(this, getTooltipHtml(d))
		})

		this.pinsDom.on('click', function (e, d) {
			e.preventDefault()
			e.stopPropagation()
			onPinClick(d)
		})
	}

	scale(scale) {
		this.svg
			.transition()
			.duration(300)
			.call(this.zoom.scaleTo, scale, [
				this.chartWidth / 2,
				this.chartHeight / 2,
			])
	}

	resetZoom() {
		// const duration = this.currentTransform.k === d3.zoomIdentity.k ? 0 : 1000;
		this.svg
			// .transition()
			// .duration(duration)
			.call(this.zoom.transform, d3.zoomIdentity)
	}

	zoomTo(name) {
		const circle = this.attrs.data.find(d => d.name === name)

		if (circle) {
			const feature = {
				type: 'Feature',
				geometry: {
					type: 'Point',
					coordinates: [circle.Longitude, circle.Latitude],
				},
				properties: {
					name: name,
				},
			}

			const [[x0, y0], [x1, y1]] = this.path.bounds(feature)

			this.svg
				.transition()
				.duration(globals.isMobile ? 350 : 750)
				.call(
					this.zoom.transform,
					d3.zoomIdentity
						.translate(this.chartWidth / 2, this.chartHeight * 0.75)
						.scale(
							Math.min(
								this.attrs.zoomExtent[1],
								0.5 /
								Math.max(
									(x1 - x0) / this.chartWidth,
									(y1 - y0) / this.chartHeight
								)
							)
						)
						.translate(-(x0 + x1) / 2, -(y0 + y1) / 2)
				)
		}
	}

	setDimensions() {
		if (!this.container) return

		let containerRect = this.container.node().getBoundingClientRect()

		if (containerRect.width > 0) {
			this.attrs.width = containerRect.width
		}

		this.attrs.height = this.attrs.width < 576 ? window.innerHeight - 250 : 745

		this.chartWidth =
			this.attrs.width - this.attrs.margin.right - this.attrs.margin.left

		this.chartHeight =
			this.attrs.height - this.attrs.margin.bottom - this.attrs.margin.top
	}

	resize() {
		this.main(true)
		this.resetZoom()
	}

	highlightPin(highlight) {
		this.pinsDom.classed('highlighted', d => {
			return d.highlighted = highlight(d)
		}).each(function (d) {
			if (d.highlighted) {
				if (this._tippy) {
					this._tippy.show()
				}
				d3.select(this).raise()
			}
		})
	}
}
