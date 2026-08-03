package routes

import (
	"time"

	"github.com/gin-gonic/gin"
	"github.com/marchelrn/scrapers/config"
	"github.com/marchelrn/scrapers/contract"
	"github.com/marchelrn/scrapers/handler"
	"github.com/marchelrn/scrapers/middleware"
	"github.com/ulule/limiter/v3"
	mgin "github.com/ulule/limiter/v3/drivers/middleware/gin"
	"github.com/ulule/limiter/v3/drivers/store/memory"
)

// SetupRoutes registers all API routes
func SetupRoutes(s *contract.Service) *gin.Engine {
	r := gin.Default()
	cfg := config.Load()

	r.RedirectTrailingSlash = true
	r.SetTrustedProxies(nil)

	rate := limiter.Rate{
		Period: 1 * time.Second,
		Limit:  100,
	}

	store := memory.NewStore()
	instance := limiter.New(store, rate)
	rateLimiter := mgin.NewMiddleware(instance)
	r.Use(rateLimiter)

	r.Use(middleware.CORSMiddleware(cfg))

	controllers := handler.New(s)

	auth := r.Group("/auth")
	{
		auth.POST("/register", controllers.Auth.Register)
		auth.POST("/login", controllers.Auth.Login)
		auth.GET("/me", middleware.AuthMiddleware(s.Auth), controllers.Auth.Me)
	}

	protected := r.Group("")
	protected.Use(middleware.AuthMiddleware(s.Auth))
	{
		// Methods (from registry)
		methods := protected.Group("/methods")
		{
			methodCtrl := handler.NewMethodController()
			methods.GET("", methodCtrl.GetAll)
		}

		// Scraping Configs
		configs := protected.Group("/configs")
		{
			configs.GET("", controllers.Config.GetAll)
			configs.POST("", controllers.Config.Create)
			configs.GET("/:id", controllers.Config.GetByID)
			configs.PUT("/:id", controllers.Config.Update)
			configs.DELETE("/:id", controllers.Config.Delete)
		}

		// Schedules
		schedules := protected.Group("/schedules")
		{
			schedules.GET("", controllers.Schedule.GetAll)
			schedules.POST("", controllers.Schedule.Create)
			schedules.GET("/:id", controllers.Schedule.GetByID)
			schedules.PUT("/:id", controllers.Schedule.Update)
			schedules.DELETE("/:id", controllers.Schedule.Delete)
		}

		// Scraping Jobs
		jobs := protected.Group("/jobs")
		{
			jobs.GET("", controllers.Job.GetAll)
			jobs.POST("", controllers.Job.Create)
			jobs.GET("/:id", controllers.Job.GetByID)
		}

		// Dashboard
		dashboard := protected.Group("/dashboard")
		{
			dashboard.GET("/summary", controllers.Dashboard.GetSummary)
		}

		// Profile (Current User)
		profile := protected.Group("/profile")
		{
			profile.PATCH("", controllers.User.UpdateProfile)
		}

		// Users (Admin Only)
		users := protected.Group("/users")
		users.Use(middleware.AdminOnly())
		{
			users.GET("", controllers.User.GetAll)
			users.GET("/:id", controllers.User.GetByID)
			users.PATCH("/:id", controllers.User.UpdateAsAdmin)
			users.DELETE("/:id", controllers.User.Delete)
		}
	}

	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"status":  "ok",
			"service": "scraping-platform",
		})
	})

	r.GET("/", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"status":  "Server is On!",
			"message": "Welcome to Scrapers",
		})
	})

	return r
}
